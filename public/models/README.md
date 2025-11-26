# LaMa Inpainting Model Setup

This directory should contain the LaMa (Large Mask Inpainting) ONNX model for AI-powered content-aware fill.

## Quick Setup

### Option 1: Download Pre-converted Model

Download a pre-converted LaMa ONNX model from one of these sources:

1. **Hugging Face**: Search for "lama onnx" models
2. **Model Zoo**: Look for LaMa/inpainting ONNX exports

Place the file as: `public/models/lama_fp16.onnx`

### Option 2: Convert from PyTorch

If you have the LaMa PyTorch checkpoint:

```python
import torch
from lama_cleaner.model.lama import LaMa  # or your LaMa implementation

# Load model
model = LaMa(...)
model.load_state_dict(torch.load('lama_checkpoint.pt'))
model.eval()

# Export to ONNX
dummy_img = torch.randn(1, 3, 512, 512)
dummy_mask = torch.randn(1, 1, 512, 512)

torch.onnx.export(
    model, 
    (dummy_img, dummy_mask),
    "lama_fp16.onnx",
    opset_version=14,
    input_names=["image", "mask"],
    output_names=["output"],
    dynamic_axes={
        "image": {0: "batch"},
        "mask": {0: "batch"},
        "output": {0: "batch"}
    }
)
```

### Option 3: Use lama-cleaner

The easiest way is to use the `lama-cleaner` package which includes model export tools:

```bash
pip install lama-cleaner
# Then export to ONNX following their documentation
```

## Model Requirements

- **Input size**: 512x512 (the app will resize automatically)
- **Format**: ONNX (opset 12-14)
- **Inputs**: 
  - `image` or `img`: Float32 tensor [1, 3, 512, 512] normalized to [0, 1]
  - `mask`: Float32 tensor [1, 1, 512, 512] where 1 = area to inpaint
- **Output**: Float32 tensor [1, 3, 512, 512] inpainted image

## Performance Notes

- The model will use **WebGPU** if available (Chrome 113+, Edge, Firefox Nightly)
- Falls back to **WebAssembly** on older browsers
- If model loading fails, the app automatically uses **PatchMatch** algorithm
- Expected inference time: 50-200ms on WebGPU, 500ms-2s on WASM

## File Size

- FP32 model: ~200-400 MB
- FP16 model: ~100-200 MB (recommended)
- INT8 quantized: ~50-100 MB (some quality loss)

## Fallback Behavior

If this model is not found or fails to load, the app will automatically use the built-in PatchMatch algorithm. PatchMatch is faster but produces less intelligent results compared to neural network inpainting.

