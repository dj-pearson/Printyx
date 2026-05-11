import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Quote,
  Search as SearchIcon,
  Table as TableIcon,
  Trash2,
  User2,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { BlogShell } from '@/components/blog/BlogShell';
import { AssetUploadDialog } from '@/components/blog/AssetUploadDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type AssetType = 'image' | 'quote' | 'data' | 'expert_contact' | 'file';
type Filter = 'all' | AssetType;

interface Asset {
  id: string;
  asset_type: AssetType;
  title: string | null;
  description: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  alt_text: string | null;
  attribution: string | null;
  expert_metadata: Record<string, unknown> | null;
  public_url?: string | null;
  created_at: string;
}

interface AssetsResponse {
  assets: Asset[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

const TYPE_LABELS: Record<Filter, string> = {
  all: 'All',
  image: 'Images',
  quote: 'Quotes',
  data: 'Data',
  expert_contact: 'Experts',
  file: 'Files',
};

const TYPE_ICON: Record<AssetType, typeof ImageIcon> = {
  image: ImageIcon,
  quote: Quote,
  data: TableIcon,
  expert_contact: User2,
  file: FileText,
};

const TYPE_COLOR: Record<AssetType, string> = {
  image: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  quote: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
  data: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  expert_contact: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  file: 'bg-muted text-muted-foreground',
};

export default function BlogAssets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (filter !== 'all') sp.set('type', filter);
    if (search.trim()) sp.set('search', search.trim());
    sp.set('limit', '200');
    return sp.toString();
  }, [filter, search]);

  const { data, isLoading } = useQuery<AssetsResponse>({
    queryKey: ['/api/blog-assets', queryString],
    queryFn: () => apiRequest(`/api/blog-assets?${queryString}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/blog-assets/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Asset deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-assets'] });
      setConfirmDeleteId(null);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const assets = data?.assets ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <BlogShell title="Assets — Blog · Printyx">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Asset Library</h1>
            <p className="text-sm text-muted-foreground">
              Reusable images, quotes, data, and expert contacts.{' '}
              <Badge variant="secondary" className="text-[10px] align-middle">
                US-BLOG-010
              </Badge>
            </p>
          </div>
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload asset
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(TYPE_LABELS) as Filter[]).map((key) => (
            <Button
              key={key}
              type="button"
              variant={filter === key ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(key)}
              className="h-8"
            >
              {TYPE_LABELS[key]}
            </Button>
          ))}
          <div className="flex-1" />
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, attribution…"
              className="pl-7 h-8 text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading assets…
          </div>
        ) : assets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground opacity-60" />
              <div className="text-sm text-muted-foreground">
                {search || filter !== 'all'
                  ? 'No assets match these filters.'
                  : 'No assets yet. Upload your first asset.'}
              </div>
              {!search && filter === 'all' ? (
                <Button size="sm" onClick={() => setShowUpload(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload asset
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {total} asset{total === 1 ? '' : 's'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onDelete={() => setConfirmDeleteId(asset.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <AssetUploadDialog open={showUpload} onOpenChange={setShowUpload} />

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              Soft delete — the row is hidden from the library but kept for audit. The file in
              Supabase Storage is NOT removed (keeps existing post references from breaking).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BlogShell>
  );
}

function AssetCard({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  const Icon = TYPE_ICON[asset.asset_type];
  const isImage = asset.asset_type === 'image' && asset.public_url;
  return (
    <Card className="overflow-hidden group">
      <div className="aspect-square bg-muted/40 flex items-center justify-center relative">
        {isImage ? (
          <img
            src={asset.public_url ?? ''}
            alt={asset.alt_text ?? asset.title ?? ''}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground/60" />
        )}
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
          title="Delete asset"
          aria-label="Delete asset"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <span
          className={cn(
            'absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
            TYPE_COLOR[asset.asset_type],
          )}
        >
          {asset.asset_type.replace('_', ' ')}
        </span>
      </div>
      <CardContent className="p-2 space-y-0.5">
        <p className="text-xs font-medium truncate" title={asset.title ?? ''}>
          {asset.title || '(untitled)'}
        </p>
        {asset.attribution ? (
          <p className="text-[10px] text-muted-foreground truncate" title={asset.attribution}>
            {asset.attribution}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
