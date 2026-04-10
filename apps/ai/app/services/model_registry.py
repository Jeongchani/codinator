from __future__ import annotations

import os
from functools import lru_cache

import torch
from transformers import AutoModelForCausalLM, AutoProcessor, CLIPModel, CLIPProcessor

from app.core.config import (
    AI_FASHION_CLIP_MODEL_ID,
    AI_FLORENCE_MODEL_ID,
    AI_HF_HOME,
    AI_HF_TOKEN,
    AI_MODEL_DEVICE,
)

if AI_HF_HOME:
    os.environ.setdefault("HF_HOME", AI_HF_HOME)


def get_torch_device() -> str:
    if AI_MODEL_DEVICE and AI_MODEL_DEVICE != "auto":
        return AI_MODEL_DEVICE
    return "cuda:0" if torch.cuda.is_available() else "cpu"


def get_torch_dtype() -> torch.dtype:
    return torch.float16 if get_torch_device().startswith("cuda") else torch.float32


@lru_cache(maxsize=1)
def get_parser_model():
    from fashn_human_parser import FashnHumanParser
    return FashnHumanParser()


@lru_cache(maxsize=1)
def get_clip_processor() -> CLIPProcessor:
    kwargs = {"token": AI_HF_TOKEN} if AI_HF_TOKEN else {}
    return CLIPProcessor.from_pretrained(AI_FASHION_CLIP_MODEL_ID, **kwargs)


@lru_cache(maxsize=1)
def get_clip_model() -> CLIPModel:
    kwargs = {"token": AI_HF_TOKEN} if AI_HF_TOKEN else {}
    model = CLIPModel.from_pretrained(AI_FASHION_CLIP_MODEL_ID, **kwargs)
    model = model.to(get_torch_device())
    model.eval()
    return model


@lru_cache(maxsize=1)
def get_florence_processor() -> AutoProcessor:
    kwargs = {
        "trust_remote_code": True,
    }
    if AI_HF_TOKEN:
        kwargs["token"] = AI_HF_TOKEN
    return AutoProcessor.from_pretrained(AI_FLORENCE_MODEL_ID, **kwargs)


@lru_cache(maxsize=1)
def get_florence_model():
    kwargs = {
        "torch_dtype": get_torch_dtype(),
        "trust_remote_code": True,
    }
    if AI_HF_TOKEN:
        kwargs["token"] = AI_HF_TOKEN

    model = AutoModelForCausalLM.from_pretrained(
        AI_FLORENCE_MODEL_ID,
        **kwargs,
    )
    model = model.to(get_torch_device())
    model.eval()
    return model