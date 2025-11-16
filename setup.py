"""
Setup file for three-jupyterlab JupyterLab extension.
"""
from pathlib import Path
from setuptools import setup

HERE = Path(__file__).parent.resolve()

# The name of the project
name = "three-jupyterlab"

lab_path = HERE / name.replace("-", "_") / "labextension"

# Representative files that should exist after a successful build
ensured_targets = [
    str(lab_path / "package.json"),
    str(lab_path / "static" / "style.js")
]

data_files_spec = [
    ("share/jupyter/labextensions/three-jupyterlab", str(lab_path), "**"),
    ("share/jupyter/labextensions/three-jupyterlab", str(HERE), "install.json"),
]

setup_args = dict(
    name=name,
    version="1.0.0",
    description="JupyterLab extension with custom UI for Python code execution",
    long_description=HERE.joinpath("README.md").read_text(encoding="utf-8"),
    long_description_content_type="text/markdown",
    author="",
    author_email="",
    url="https://github.com/your-username/three-jupyterlab",
    license="MIT",
    packages=[],
    zip_safe=False,
    include_package_data=True,
    install_requires=[
        "jupyterlab>=4.0.0",
    ],
    extras_require={
        "dev": [
            "jupyterlab>=4.0.0",
            "jupyter-packaging>=0.10",
        ],
    },
    python_requires=">=3.8",
)

try:
    from jupyter_packaging import (
        wrap_installers,
        npm_builder,
        get_data_files
    )
    post_develop = npm_builder(
        build_cmd="build", source_dir=".", build_dir=lab_path
    )
    setup_args["cmdclass"] = wrap_installers(
        post_develop=post_develop, ensured_targets=ensured_targets
    )
    setup_args["data_files"] = get_data_files(data_files_spec)
except ImportError as e:
    import logging
    logging.basicConfig(format="%(levelname)s: %(message)s")
    logging.warning(
        "Build tool `jupyter-packaging` is not installed. "
        "It is required for building a development install. "
        "Please install it with pip or conda."
    )
    # Don't fail if jupyter-packaging is not installed
    setup_args["data_files"] = []

if __name__ == "__main__":
    setup(**setup_args)

