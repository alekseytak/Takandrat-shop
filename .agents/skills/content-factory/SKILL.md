---
name: content-factory
description: Build truthful product photo, video, copy, and publishing assets from approved Tak and Rat catalog sources. Use when planning or running the atelier content pipeline.
metadata:
  shelllm:
    requires:
      bins: ["jq"]
---

# content-factory

Use approved product records and source photos only. Never invent material, construction, dimensions, availability, price, delivery, or product claims.

## Pipeline

1. Read the catalog record and mark each fact as approved or missing.
2. Create a content brief with product ID, asset type, target placement, aspect ratio, duration, and source files.
3. Generate drafts with a local model first. Use a cloud model only after checking the current provider, model, price, limits, and credentials.
4. Compare every image or video with the source. Reject changed stitching, hardware, texture, shape, color, logos, or included items.
5. Keep source files and prompts. Write outputs to a new versioned directory.
6. Review copy for unsupported claims and review video for first frame, final frame, loop, poster, and mobile size.
7. Publish only after owner approval. Track production facts such as render time, rejection reason, and asset status. Do not track customer identity or sales behavior.

## Local model roles

- Small local text models: classify briefs, extract facts, make variants, and flag missing fields.
- Larger local text models: draft Russian copy and scripts after the fact set is supplied.
- Image models: use only as controlled edits against an approved product photo. Do not use text-to-image for the product itself.
- Video models: create restrained camera motion from an approved still. Keep a still fallback.

## Minimum brief

```json
{"product_id":"ch-01","asset_type":"photo_detail","source_files":["approved/source.jpg"],"placement":"catalog","aspect_ratio":"4:5","facts":["approved fact"],"missing_facts":[]}
```

## Gate

A draft stays `needs_review` until an owner approves it. A failed visual or factual check stays rejected. Do not overwrite an approved asset. Do not send private customer data to any model.
