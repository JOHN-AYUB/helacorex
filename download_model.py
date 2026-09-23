#!/usr/bin/env python3
"""
Download models for Helacore AI Advisor.

This script downloads small language models that can be fine-tuned locally.
It handles authentication and provides progress feedback.

Usage:
    # Download TinyLlama-1.1B (requires HF_TOKEN for authenticated models)
    python download_model.py --model tinyllama
    
    # Download Phi-2 (public, no auth required)
    python download_model.py --model phi2
    
    # Download Phi-1.5 (public, smaller)
    python download_model.py --model phi1_5
    
    # With authentication token
    HF_TOKEN=your_token_here python download_model.py --model tinyllama
    
    # Specify custom output directory
    python download_model.py --model phi2 --output models/phi-2
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Optional

# Model configurations
MODEL_CONFIGS = {
    "tinyllama": {
        "id": "TinyLlama/TinyLlama-1.1B",
        "size": "~2.2GB",
        "params": "1.1B",
        "requires_auth": True,
        "recommended": True,
    },
    "phi2": {
        "id": "microsoft/phi-2",
        "size": "~5.4GB",
        "params": "2.7B",
        "requires_auth": False,
        "recommended": True,
    },
    "phi1_5": {
        "id": "microsoft/phi-1_5",
        "size": "~3.3GB",
        "params": "1.5B",
        "requires_auth": False,
        "recommended": True,
    },
    "gemma-2b": {
        "id": "google/gemma-2b",
        "size": "~3.5GB",
        "params": "2B",
        "requires_auth": False,
        "recommended": False,
    },
    "opt-1.3b": {
        "id": "facebook/opt-1.3b",
        "size": "~2.5GB",
        "params": "1.3B",
        "requires_auth": False,
        "recommended": False,
    },
}


def get_hf_token() -> Optional[str]:
    """Get HuggingFace token from environment or .env file."""
    # Check environment variable
    token = os.environ.get("HF_TOKEN")
    if token:
        return token
    
    # Check .env file
    env_path = Path(".env")
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("HF_TOKEN=") or line.startswith("HUGGINGFACE_TOKEN="):
                    return line.split("=", 1)[1].strip()
    
    return None


def download_model(
    model_name: str,
    output_dir: Path,
    use_auth: bool = True,
) -> bool:
    """Download a model using transformers library."""
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        print("❌ Error: transformers library not found")
        print("   Install with: pip install transformers")
        return False
    
    if model_name not in MODEL_CONFIGS:
        print(f"❌ Error: Unknown model '{model_name}'")
        print(f"   Available models: {', '.join(MODEL_CONFIGS.keys())}")
        return False
    
    config = MODEL_CONFIGS[model_name]
    model_id = config["id"]
    
    print(f"🚀 Downloading {model_name} ({config['params']} parameters, {config['size']})")
    print(f"   Model ID: {model_id}")
    print(f"   Output: {output_dir.resolve()}")
    print()
    
    # Check authentication
    if config["requires_auth"] and not use_auth:
        print("⚠️  This model requires authentication")
        print("   Set HF_TOKEN environment variable or use --auth flag")
        return False
    
    # Set up cache directory
    cache_dir = output_dir.parent / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Download with or without auth
        kwargs = {"cache_dir": str(cache_dir)}
        if use_auth and config["requires_auth"]:
            token = get_hf_token()
            if token:
                kwargs["use_auth_token"] = token
                print("🔑 Using authentication token")
            else:
                print("⚠️  No authentication token found, trying without...")
        
        print("1️⃣ Downloading model weights...")
        model = AutoModelForCausalLM.from_pretrained(model_id, **kwargs)
        
        print("2️⃣ Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(model_id, **kwargs)
        
        print("3️⃣ Saving to disk...")
        output_dir.mkdir(parents=True, exist_ok=True)
        model.save_pretrained(str(output_dir))
        tokenizer.save_pretrained(str(output_dir))
        
        # Calculate size
        total_size = sum(
            f.stat().st_size 
            for f in output_dir.glob("*") 
            if f.is_file()
        )
        size_mb = total_size / (1024 * 1024)
        size_gb = size_mb / 1024
        
        print()
        print(f"✅ Successfully downloaded {model_name}!")
        print(f"   Location: {output_dir.resolve()}")
        print(f"   Size: {size_mb:.1f} MB ({size_gb:.2f} GB)")
        print()
        print("   Files:")
        for f in sorted(output_dir.glob("*")):
            if f.is_file():
                size = f.stat().st_size / (1024 * 1024)
                print(f"   - {f.name:40s} ({size:.1f} MB)")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Download failed: {e}")
        if "401" in str(e) or "403" in str(e):
            print("\n   This model requires authentication.")
            print("   Set HF_TOKEN environment variable with your HuggingFace token.")
            print("   Get a token at: https://huggingface.co/settings/tokens")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Download models for Helacore AI Advisor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download Phi-2 (public, no auth)
  python download_model.py --model phi2

  # Download TinyLlama-1.1B with auth
  HF_TOKEN=your_token python download_model.py --model tinyllama

  # List available models
  python download_model.py --list
        """
    )
    
    parser.add_argument(
        "--model", "-m",
        type=str,
        default=None,
        help="Model to download (tinyllama, phi2, phi1_5, gemma-2b, opt-1.3b)"
    )
    
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=None,
        help="Output directory (default: models/{model_name})"
    )
    
    parser.add_argument(
        "--auth", "-a",
        action="store_true",
        help="Use authentication token (required for some models)"
    )
    
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available models"
    )
    
    args = parser.parse_args()
    
    if args.list:
        print("Available models:")
        print()
        for name, config in MODEL_CONFIGS.items():
            auth_str = " [Auth Required]" if config["requires_auth"] else ""
            rec_str = " ✨" if config["recommended"] else ""
            print(f"  {name:15s} - {config['params']:>6s} params, {config['size']:>8s}{auth_str}{rec_str}")
            print(f"               {config['id']}")
        return
    
    if not args.model:
        print("❌ Error: Please specify a model with --model")
        print("   Use --list to see available models")
        sys.exit(1)
    
    if args.model not in MODEL_CONFIGS:
        print(f"❌ Error: Unknown model '{args.model}'")
        print(f"   Available models: {', '.join(MODEL_CONFIGS.keys())}")
        sys.exit(1)
    
    # Set output directory
    if args.output:
        output_dir = args.output
    else:
        output_dir = Path("models") / args.model
    
    # Download
    success = download_model(
        model_name=args.model,
        output_dir=output_dir,
        use_auth=args.auth,
    )
    
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
