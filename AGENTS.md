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

## Application rules
- Keep chat answers routed through the existing n8n production webhook; presentation and speech changes must not replace its answer source.
- Generate speech through the TanStack streaming speech route and play PCM chunks sequentially in the browser; this preserves natural delivery and interruptible playback.
- Keep visual roles in the global CSS semantic tokens so the industrial design stays consistent across controls.
