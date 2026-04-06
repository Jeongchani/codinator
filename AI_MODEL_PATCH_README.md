# AI model patch notes

## What changed
- Replaced scaffold-based `apps/ai/app/services/image_analysis_service.py` with a real model pipeline orchestrator.
- Added parser / embedding / caption services under `apps/ai/app/services`.
- Kept the existing response JSON shape for `/api/v2/analyze-image` and `/api/v2/ai/analyze-image`.
- Kept `blur-face` path untouched.
- Increased API proxy timeout from 15s to 60s.

## New runtime dependencies
- `fashn-human-parser`
- `torch`
- `transformers`
- `pillow`
- `accelerate`
- `safetensors`
- `sentencepiece`

## New env vars
Check `apps/ai/.env.example`.

## Important note about torch
Depending on the target machine, you may need to install a CPU or CUDA-specific wheel for torch instead of relying on plain `pip install -r requirements.txt`.

## Test order
1. `POST /api/v2/health`
2. `POST /api/v2/blur-face`
3. `POST /api/v2/analyze-image`
4. `POST /api/v2/ai/analyze-image`

## Known limitations
- The parser model can return accessory masks, but it does not provide shoe labels.
- `dress` is mapped to `ETC` to avoid breaking the current category set.
- No DB persistence is included in this patch.
