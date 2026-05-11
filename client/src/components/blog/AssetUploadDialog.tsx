import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload as UploadIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AssetType = 'image' | 'quote' | 'data' | 'expert_contact' | 'file';

interface UploadUrlResponse {
  signed_url: string;
  token: string;
  storage_path: string;
  bucket: string;
}

interface AssetCreateResponse {
  asset: {
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
  };
}

interface AssetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lock the asset type when the dialog is launched from a type-scoped picker (e.g. editor image picker). */
  forcedType?: AssetType;
  /** Called with the created asset on success. */
  onUploaded?: (asset: AssetCreateResponse['asset']) => void;
}

const TYPE_LABELS: Record<AssetType, string> = {
  image: 'Image',
  quote: 'Quote',
  data: 'Data table',
  expert_contact: 'Expert contact',
  file: 'File',
};

const ACCEPT_BY_TYPE: Record<AssetType, string> = {
  image: 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/avif',
  data: 'text/csv,application/json',
  file: '',
  quote: '',
  expert_contact: '',
};

const FILE_REQUIRED: Record<AssetType, boolean> = {
  image: true,
  data: false,
  file: true,
  quote: false,
  expert_contact: false,
};

const MAX_BYTES = 25 * 1024 * 1024;

export function AssetUploadDialog({
  open,
  onOpenChange,
  forcedType,
  onUploaded,
}: AssetUploadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<AssetType>(forcedType ?? 'image');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [altText, setAltText] = useState('');
  const [attribution, setAttribution] = useState('');
  const [expertName, setExpertName] = useState('');
  const [expertTitle, setExpertTitle] = useState('');
  const [expertOrg, setExpertOrg] = useState('');
  const [expertContact, setExpertContact] = useState('');
  const [expertExpertise, setExpertExpertise] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setType(forcedType ?? 'image');
    setTitle('');
    setDescription('');
    setAltText('');
    setAttribution('');
    setExpertName('');
    setExpertTitle('');
    setExpertOrg('');
    setExpertContact('');
    setExpertExpertise('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      let storagePath: string | null = null;
      let mimeType: string | null = null;
      let fileSizeBytes: number | null = null;

      if (file) {
        if (file.size > MAX_BYTES) {
          throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`);
        }
        // Step 1 — get signed upload URL
        const upload = await apiRequest<UploadUrlResponse>('/api/blog-assets/upload-url', 'POST', {
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
        });
        // Step 2 — PUT file directly to storage
        const putRes = await fetch(upload.signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Storage upload failed (${putRes.status})`);
        }
        storagePath = upload.storage_path;
        mimeType = file.type || 'application/octet-stream';
        fileSizeBytes = file.size;
      } else if (FILE_REQUIRED[type]) {
        throw new Error(`A file is required for ${TYPE_LABELS[type]} assets`);
      }

      // Step 3 — create the metadata row
      const expertMeta =
        type === 'expert_contact'
          ? {
              name: expertName.trim() || undefined,
              title: expertTitle.trim() || undefined,
              org: expertOrg.trim() || undefined,
              contact: expertContact.trim() || undefined,
              expertise: expertExpertise
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 20),
            }
          : null;

      const created = await apiRequest<AssetCreateResponse>('/api/blog-assets', 'POST', {
        asset_type: type,
        title: title.trim() || null,
        description: description.trim() || null,
        storage_path: storagePath,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
        alt_text: type === 'image' ? altText.trim() || null : null,
        attribution: attribution.trim() || null,
        expert_metadata:
          expertMeta &&
          Object.values(expertMeta).some((v) => v && (Array.isArray(v) ? v.length : true))
            ? expertMeta
            : null,
      });
      return created.asset;
    },
    onSuccess: (asset) => {
      toast({ title: 'Asset created' });
      queryClient.invalidateQueries({ queryKey: ['/api/blog-assets'] });
      onUploaded?.(asset);
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !uploadMutation.isPending) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload asset</DialogTitle>
          <DialogDescription>
            Create a reusable asset. Image attribution and quote source URLs are non-negotiable for
            E-E-A-T.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!forcedType ? (
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AssetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as AssetType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {ACCEPT_BY_TYPE[type] !== undefined && type !== 'quote' && type !== 'expert_contact' ? (
            <div className="space-y-1">
              <Label htmlFor="asset-file" className="text-xs">
                File {FILE_REQUIRED[type] ? '*' : '(optional)'}
              </Label>
              <Input
                ref={fileInputRef}
                id="asset-file"
                type="file"
                accept={ACCEPT_BY_TYPE[type] || undefined}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <p className="text-[11px] text-muted-foreground">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="asset-title" className="text-xs">
              Title
            </Label>
            <Input
              id="asset-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, descriptive name"
              maxLength={500}
            />
          </div>

          {type === 'image' ? (
            <div className="space-y-1">
              <Label htmlFor="asset-alt" className="text-xs">
                Alt text *
              </Label>
              <Textarea
                id="asset-alt"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="What does the image show? Used by screen readers and SEO."
                rows={2}
                maxLength={2000}
              />
            </div>
          ) : null}

          {type === 'quote' ? (
            <div className="space-y-1">
              <Label htmlFor="asset-quote" className="text-xs">
                Quote text *
              </Label>
              <Textarea
                id="asset-quote"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="The full quote, in their words"
                rows={4}
                maxLength={10000}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="asset-desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="asset-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Internal notes, license, what this is for"
                rows={2}
                maxLength={10000}
              />
            </div>
          )}

          {type !== 'expert_contact' ? (
            <div className="space-y-1">
              <Label htmlFor="asset-attr" className="text-xs">
                Attribution / Source URL
              </Label>
              <Input
                id="asset-attr"
                value={attribution}
                onChange={(e) => setAttribution(e.target.value)}
                placeholder='e.g. "Photo by Jane Doe (CC-BY)" or https://source.example.com'
                maxLength={2000}
              />
            </div>
          ) : null}

          {type === 'expert_contact' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={expertName} onChange={(e) => setExpertName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={expertTitle} onChange={(e) => setExpertTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Organization</Label>
                <Input value={expertOrg} onChange={(e) => setExpertOrg(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contact (email or URL)</Label>
                <Input value={expertContact} onChange={(e) => setExpertContact(e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Expertise tags (comma-separated)</Label>
                <Input
                  value={expertExpertise}
                  onChange={(e) => setExpertExpertise(e.target.value)}
                  placeholder="copier-leasing, mps, sales-ops"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={uploadMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => uploadMutation.mutate()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UploadIcon className="h-4 w-4 mr-2" />
            )}
            Save asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssetUploadDialog;
