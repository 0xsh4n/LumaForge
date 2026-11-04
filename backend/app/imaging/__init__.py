"""Image processing primitives for LumaForge.

All processing operates on float32 RGB arrays in the range [0, 1]. Pixels are
display-referred (sRGB-encoded) unless a function explicitly says it works in
linear light. Keeping a single, documented convention is what makes the
adjustment math predictable and the results natural.
"""
