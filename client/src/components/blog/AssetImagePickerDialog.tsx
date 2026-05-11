import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Search as SearchIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AssetUploadDialog } from './AssetUploadDialog';
import { cn } from '@/lib/utils';

interface ImageAsset {
  id: string;
  asset_type: 'image';
  title: string | null;
  alt_text: string | null;
  attribution: string | null;
  public_url?: string | null;
  storage_path: string | null;
}

interface AssetsResponse {
  assets: ImageAsset[];
}

interface AssetImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when an image is selected. */
  onSelect: (params: { url: string; alt: string }) => void;
}

export function AssetImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: AssetImagePickerDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const { data, isLoading } = useQuery<AssetsResponse>({
    queryKey: ['/api/blog-assets', 'image', search],
    queryFn: () => {
      const sp = new URLSearchParams({ type: 'image', limit: '100' });
      if (search.trim()) sp.set('search', search.trim());
      return apiRequest(`/api/blog-assets?${sp.toString()}`);
    },
    enabled: open,
  });

  const assets = data?.assets ?? [];
  const selected = assets.find((a) => a.id === selectedId) ?? null;

  const handleInsert = () => {
    if (!selected?.public_url) return;
    onSelect({ url: selected.public_url, alt: selected.alt_text ?? selected.title ?? '' });
    setSelectedId(null);
    setSearch('');
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Insert image</DialogTitle>
            <DialogDescription>
              Pick from the asset library or upload a new image. Alt text is required for
              accessibility.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search images…"
                className="pl-7 h-8 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Upload new
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : assets.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {search ? 'No images match this search.' : 'No images yet. Upload one.'}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedId(asset.id)}
                    className={cn(
                      'relative aspect-square rounded border-2 overflow-hidden bg-muted transition-colors',
                      selectedId === asset.id
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-transparent hover:border-muted-foreground/40',
                    )}
                    title={asset.title ?? ''}
                  >
                    {asset.public_url ? (
                      <img
                        src={asset.public_url}
                        alt={asset.alt_text ?? asset.title ?? ''}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected ? (
            <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-0.5">
              <p className="font-medium truncate">{selected.title ?? '(untitled)'}</p>
              <p className="text-muted-foreground truncate">
                Alt: {selected.alt_text || <span className="italic">missing</span>}
              </p>
              {selected.attribution ? (
                <p className="text-muted-foreground truncate">{selected.attribution}</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsert} disabled={!selected?.public_url}>
              Insert image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssetUploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        forcedType="image"
        onUploaded={(asset) => {
          // Auto-select the freshly uploaded asset
          setSelectedId(asset.id);
        }}
      />
    </>
  );
}

export default AssetImagePickerDialog;
