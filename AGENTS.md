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

- Keep A4 label layout, raster export and PNG density metadata in a shared browser-side module, reused by label screens, so print dimensions and pagination remain consistent.
- Enable A4 export in the shared batch control through optional configuration and reuse its batch-content builder, so PNG quantities and same/unique modes match the 3D export settings without affecting other generators.
