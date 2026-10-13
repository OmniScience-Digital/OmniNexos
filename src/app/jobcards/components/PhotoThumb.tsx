// src/app/jobcards/components/PhotoThumb.tsx  
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getFileUrl } from "@/services/jobCardTime.service";

/** A photo from storage. Fetches a signed link; shows the label instead if the file cannot be opened. */
export default function PhotoThumb({ storageKey, label }: { storageKey: string; label: string }) {
  const [state, setState] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFileUrl(storageKey)
      .then((url) => { if (!cancelled) setState({ key: storageKey, url }); })
      .catch(() => { if (!cancelled) setState({ key: storageKey, url: null }); });
    return () => { cancelled = true; };
  }, [storageKey]);

  const url = state?.key === storageKey ? state.url : undefined; // undefined = still loading

  return (
    <figure className="w-24">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title={`Open ${label}`}>
          <img src={url} alt={label} loading="lazy" className="h-20 w-24 rounded-md border border-border object-cover" />
        </a>
      ) : (
        <div className="flex h-20 w-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-muted-foreground">
          {url === null ? <ImageOff className="h-4 w-4" /> : <span className="text-[10px]">Loading</span>}
        </div>
      )}
      <figcaption className="mt-1 truncate text-center text-[11px] text-muted-foreground">{label}</figcaption>
    </figure>
  );
}