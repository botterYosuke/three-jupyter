import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface KernelMessage {
  type: string;
  content: any;
}

@Injectable({
  providedIn: 'root'
})
export class JupyterService {
  private kernelGatewayUrl = 'http://127.0.0.1:8889';
  private wsUrl = 'ws://127.0.0.1:8889';
  private kernelId: string | null = null;
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<KernelMessage>();
  private executeSubject = new Subject<any>();

  constructor(private http: HttpClient) {}

  // Kernel を起動
  startKernel(): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post(
      `${this.kernelGatewayUrl}/api/kernels`,
      { name: 'python3' },
      { headers }
    );
  }

  // WebSocket 接続を開始
  connectWebSocket(kernelId: string): void {
    this.kernelId = kernelId;
    const wsPath = `${this.wsUrl}/api/kernels/${kernelId}/channels`;
    this.ws = new WebSocket(wsPath);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.messageSubject.next({
        type: 'error',
        content: { error: 'WebSocket connection error' }
      });
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
    };
  }

  // メッセージを処理
  private handleMessage(message: any): void {
    const msgType = message.msg_type;
    const content = message.content;

    if (msgType === 'execute_result' || msgType === 'stream') {
      const output = content.text || content.data || '';
      this.executeSubject.next({ output, type: msgType });
    } else if (msgType === 'error') {
      const error = content.ename + ': ' + content.evalue;
      this.executeSubject.next({ error, type: msgType });
    } else if (msgType === 'execute_reply') {
      if (content.status === 'ok') {
        this.executeSubject.next({ status: 'ok' });
      } else if (content.status === 'error') {
        this.executeSubject.next({ error: 'Execution error', type: msgType });
      }
    }

    this.messageSubject.next({ type: msgType, content });
  }

  // コードを実行
  executeCode(code: string): Observable<any> {
    if (!this.kernelId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Kernel is not connected');
    }

    const message = {
      header: {
        msg_id: this.generateUUID(),
        username: 'user',
        session: this.generateUUID(),
        msg_type: 'execute_request',
        version: '5.3'
      },
      parent_header: {},
      metadata: {},
      content: {
        code: code,
        silent: false,
        store_history: true,
        user_expressions: {},
        allow_stdin: false
      }
    };

    this.ws.send(JSON.stringify(message));

    return this.executeSubject.asObservable();
  }

  // UUID を生成
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Kernel を停止
  stopKernel(): Observable<any> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (!this.kernelId) {
      return new Observable(observer => {
        observer.complete();
      });
    }

    const kernelId = this.kernelId;
    this.kernelId = null;

    return this.http.delete(`${this.kernelGatewayUrl}/api/kernels/${kernelId}`);
  }

  // Kernel ID を設定
  setKernelId(kernelId: string): void {
    this.kernelId = kernelId;
    this.connectWebSocket(kernelId);
  }

  // Kernel ID を取得
  getKernelId(): string | null {
    return this.kernelId;
  }

  // メッセージストリームを取得
  getMessageStream(): Observable<KernelMessage> {
    return this.messageSubject.asObservable();
  }
}

