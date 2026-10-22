<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep A4 label layout, raster export, PNG density metadata and PDF packaging in a shared browser-side module; PDF must reuse rendered PNG sheets at A4 physical size, preserving codes, artwork and pagination without reserving new activation IDs.
- Pass batch social/NFC selection into the A4 dialog and initialize rectangular layout when selected icons are enabled, so artwork does not silently disappear between formats.
- Rectangular A4 labels reserve a separate left icon column and calculate pagination from the full label bounds; keep the selected QR footprint and its quiet zone independent of decorations.
- Optional social artwork for QR plate batches enters the shared QR geometry as cached browser-rasterized masks, so STL and 3MF preserve identical QR dimensions and use the code material for icons; other model generators opt in separately.
- Enable A4 export in the shared batch control through optional configuration and reuse its batch-content builder, so PNG quantities and same/unique modes match the 3D export settings without affecting other generators.
- Activation label exports must obtain server-confirmed stock IDs through the shared registered-label helper before rendering; reuse reserved codes across formats so every printed activation URL exists and points to the same piece.
