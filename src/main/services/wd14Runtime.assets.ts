export interface PinnedAsset {
  url: string
  sha256: string
  size: number
}

interface PlatformAssets {
  python: PinnedAsset
  onnxruntime: PinnedAsset
  numpy: PinnedAsset
  pillow: PinnedAsset
}

const PYTHON_RELEASE_TAG = '20260807'
const PYTHON_BASE_URL = `https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_RELEASE_TAG}`

const ONNXRUNTIME_MAC_UNIVERSAL2: PinnedAsset = {
  url: 'https://files.pythonhosted.org/packages/4d/de/9162872c6e502e9ac8c99a98a8738b2fab408123d11de55022ac4f92562a/onnxruntime-1.22.0-cp312-cp312-macosx_13_0_universal2.whl',
  sha256: 'f3c0380f53c1e72a41b3f4d6af2ccc01df2c17844072233442c3a7e74851ab97',
  size: 34298046
}

/**
 * One entry per platform/arch combo this app actually ships installers for
 * (`electron-builder.yml` targets win/mac/linux). Every URL+sha256+size was
 * captured directly from GitHub Releases/PyPI/Hugging Face's own APIs - see
 * the plan doc's "Research findings" section for how each was verified.
 * Bumping any of these is a deliberate, re-verified update, not something
 * to hand-edit casually.
 */
const PLATFORM_ASSETS: Record<string, PlatformAssets> = {
  'win32-x64': {
    python: {
      url: `${PYTHON_BASE_URL}/cpython-3.12.13%2B20260807-x86_64-pc-windows-msvc-install_only.tar.gz`,
      sha256: '6cf2be701aa7e9470454c9c86285c1bcc1832518d63e39c3e34e9d8ea1cbb99f',
      size: 46143590
    },
    onnxruntime: {
      url: 'https://files.pythonhosted.org/packages/36/b4/3f1c71ce1d3d21078a6a74c5483bfa2b07e41a8d2b8fb1e9993e6a26d8d3/onnxruntime-1.22.0-cp312-cp312-win_amd64.whl',
      sha256: 'c0d534a43d1264d1273c2d4f00a5a588fa98d21117a3345b7104fa0bbcaadb9a',
      size: 12692233
    },
    numpy: {
      url: 'https://files.pythonhosted.org/packages/7f/b9/87fea2769fe1c47c1b5b01d8310772c9d1a85d485de7cf386ef7a3332b02/numpy-2.5.2-cp312-cp312-win_amd64.whl',
      sha256: '28ac63476ec7651484215ee7fa15a1f78b57c14621f01e392afe17b9a1390ce4',
      size: 12464674
    },
    pillow: {
      url: 'https://files.pythonhosted.org/packages/45/89/da2f7971a317f83d807fdd4065c0af40208e59e692cc43d315a71a0e96d1/pillow-12.3.0-cp312-cp312-win_amd64.whl',
      sha256: 'a2b55dd6b2a4c4b7d87ffa56bdb33fdc5fdb9a462173861a7bc097f17d91cb09',
      size: 7227137
    }
  },
  'darwin-x64': {
    python: {
      url: `${PYTHON_BASE_URL}/cpython-3.12.13%2B20260807-x86_64-apple-darwin-install_only.tar.gz`,
      sha256: 'ce9dc826a3215d5deadf6d7ba409a882b8d431192c4c06deb34ff00f93ceb4f5',
      size: 24846131
    },
    onnxruntime: ONNXRUNTIME_MAC_UNIVERSAL2,
    numpy: {
      url: 'https://files.pythonhosted.org/packages/69/72/dccb0aaf40972777283303919f613964227266d0c13adebb79ac124f1c3e/numpy-2.5.2-cp312-cp312-macosx_10_13_x86_64.whl',
      sha256: '14e373cfc6387177e8409dac3c7159be8eb05cd77096cd7c950268b86f62831c',
      size: 16891693
    },
    pillow: {
      url: 'https://files.pythonhosted.org/packages/37/bf/fb3ebff8ddcb76aac5a01389251bbbb9519922a9b520d8247c1ca864a25d/pillow-12.3.0-cp312-cp312-macosx_10_13_x86_64.whl',
      sha256: 'ba09209fbe443b4acccebe845d8a138b89a8f4fbaeedd44953490b5315d5e965',
      size: 5345969
    }
  },
  'darwin-arm64': {
    python: {
      url: `${PYTHON_BASE_URL}/cpython-3.12.13%2B20260807-aarch64-apple-darwin-install_only.tar.gz`,
      sha256: '4201588fc5051c2ba988abbe1f033d318965ee378fadf7fb7ef79882ba7be84b',
      size: 25166802
    },
    onnxruntime: ONNXRUNTIME_MAC_UNIVERSAL2,
    numpy: {
      url: 'https://files.pythonhosted.org/packages/60/2e/b5aee50a1f74ac815cf8331812cb8251e29024025de462e0c047641c614c/numpy-2.5.2-cp312-cp312-macosx_11_0_arm64.whl',
      sha256: '4bbd96c833ecc8cc069ce518078fc8c60cb9cbfb0fea5b7a803ad65035596d03',
      size: 11903109
    },
    pillow: {
      url: 'https://files.pythonhosted.org/packages/d8/66/9a386a92561f402389a4fc70c18838bf6d35eb5eb5c6850b4b2dc64f5048/pillow-12.3.0-cp312-cp312-macosx_11_0_arm64.whl',
      sha256: 'ffd0c5368496f41b0944be820fcb7a838aa6e623d250b01acf2643939c3f99d7',
      size: 4780323
    }
  },
  'linux-x64': {
    python: {
      url: `${PYTHON_BASE_URL}/cpython-3.12.13%2B20260807-x86_64-unknown-linux-gnu-install_only.tar.gz`,
      sha256: '5bd6f36fd7ef02b909234c94dca9994ef0da06ace3bc3cece4fe27870e9cdbbe',
      size: 109257932
    },
    onnxruntime: {
      url: 'https://files.pythonhosted.org/packages/8c/60/16d219b8868cc8e8e51a68519873bdb9f5f24af080b62e917a13fff9989b/onnxruntime-1.22.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl',
      sha256: '6964a975731afc19dc3418fad8d4e08c48920144ff590149429a5ebe0d15fb3c',
      size: 16406377
    },
    numpy: {
      url: 'https://files.pythonhosted.org/packages/3a/5f/62d28cf019460c7f1394105b4d49d9911a9c444cb77ab0bd95a204c5a6de/numpy-2.5.2-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl',
      sha256: '3cdec01fa790a186d430433fdd4d4ffb70eed6f0eeb4bf05c8dbe2dce0a9bcb8',
      size: 16722264
    },
    pillow: {
      url: 'https://files.pythonhosted.org/packages/84/21/a35af28dcc61f37ed850a2d64c65c701321dfbf25085e469d5559360cbbf/pillow-12.3.0-cp312-cp312-manylinux_2_27_x86_64.manylinux_2_28_x86_64.whl',
      sha256: '78cb2c6865a35ab8ff8b75fd122f6033b92a62c82801110e48ddd6c936a45d91',
      size: 6940830
    }
  }
}

export function getPlatformAssets(): PlatformAssets | null {
  return PLATFORM_ASSETS[`${process.platform}-${process.arch}`] ?? null
}

export function getModelAssets(): { model: PinnedAsset; tags: PinnedAsset } {
  return {
    model: {
      url: 'https://huggingface.co/SmilingWolf/wd-vit-tagger-v3/resolve/main/model.onnx',
      sha256: '35f23693620b668f4d53fd3c62bf65e40af739bc52c7eb0fbc49258b58d065b6',
      size: 378536310
    },
    tags: {
      url: 'https://huggingface.co/SmilingWolf/wd-vit-tagger-v3/resolve/main/selected_tags.csv',
      sha256: '298633d94d0031d2081c0893f29c82eab7f0df00b08483ba8f29d1e979441217',
      size: 308468
    }
  }
}
