import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JupyterService } from './jupyter.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  code: string = 'print("Hello, Jupyter!")';
  output: string = '';
  isExecuting: boolean = false;
  isKernelReady: boolean = false;
  error: string = '';

  constructor(private jupyterService: JupyterService) {}

  ngOnInit(): void {
    this.startKernel();
  }

  ngOnDestroy(): void {
    this.stopKernel();
  }

  startKernel(): void {
    this.jupyterService.startKernel().subscribe({
      next: (response: any) => {
        if (response.id) {
          this.jupyterService.setKernelId(response.id);
          this.isKernelReady = true;
          this.output = 'Kernel が起動しました。\n';
        }
      },
      error: (err) => {
        this.error = `Kernel の起動に失敗しました: ${err.message}`;
        console.error('Kernel start error:', err);
      }
    });
  }

  stopKernel(): void {
    if (this.isKernelReady) {
      this.jupyterService.stopKernel().subscribe({
        next: () => {
          this.isKernelReady = false;
          this.output += '\nKernel が停止しました。';
        },
        error: (err) => {
          console.error('Kernel stop error:', err);
        }
      });
    }
  }

  executeCode(): void {
    if (!this.isKernelReady) {
      this.error = 'Kernel が起動していません。';
      return;
    }

    if (!this.code.trim()) {
      this.error = 'コードを入力してください。';
      return;
    }

    this.isExecuting = true;
    this.error = '';
    this.output += `\n>>> ${this.code}\n`;

    const subscription = this.jupyterService.executeCode(this.code).subscribe({
      next: (response: any) => {
        if (response.output !== undefined) {
          this.output += response.output + '\n';
        }
        if (response.error) {
          this.output += `エラー: ${response.error}\n`;
          this.isExecuting = false;
          subscription.unsubscribe();
        }
        if (response.status === 'ok') {
          this.isExecuting = false;
          subscription.unsubscribe();
        }
      },
      error: (err) => {
        this.isExecuting = false;
        this.error = `実行エラー: ${err.message}`;
        this.output += `エラー: ${err.message}\n`;
        console.error('Execute error:', err);
        subscription.unsubscribe();
      }
    });
  }

  clearOutput(): void {
    this.output = '';
    this.error = '';
  }
}

