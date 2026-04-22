import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Users, Save } from 'lucide-react';

interface SpecialtyMeta {
  key: string;
  displayName: string;
  shortDescription: string;
}

interface SpecialtyPack {
  displayName: string;
  shortDescription: string;
  expertisePositioning: string;
  commonBuyerTitles: string[];
  commonPains: string[];
  triggerSignals: string[];
  valueProps: string[];
}

interface UserSpecialty {
  specialty: string;
  weight: number;
  experienceYears?: number;
  personalNotes?: string;
}

export default function MySpecialty() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Map<string, UserSpecialty>>(new Map());

  const { data: specialtyData } = useQuery<{
    specialties: SpecialtyMeta[];
    packs: Record<string, SpecialtyPack>;
  }>({
    queryKey: ['/api/outreach/specialties'],
    queryFn: () => apiRequest('/api/outreach/specialties'),
  });

  const { data: mineData, isLoading } = useQuery<{ specializations: UserSpecialty[] }>({
    queryKey: ['/api/outreach/specializations'],
    queryFn: () => apiRequest('/api/outreach/specializations'),
  });

  useEffect(() => {
    if (mineData?.specializations) {
      const map = new Map<string, UserSpecialty>();
      for (const s of mineData.specializations) map.set(s.specialty, s);
      setSelected(map);
    }
  }, [mineData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/outreach/specializations', 'PUT', {
        specializations: Array.from(selected.values()),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/outreach/specializations'] });
      toast({ title: 'Saved', description: 'Your specialties are updated.' });
    },
    onError: (err: any) =>
      toast({
        title: 'Save failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      }),
  });

  const toggleSpecialty = (key: string) => {
    const next = new Map(selected);
    if (next.has(key)) next.delete(key);
    else next.set(key, { specialty: key, weight: 100 });
    setSelected(next);
  };

  const updateField = (key: string, field: keyof UserSpecialty, value: any) => {
    const next = new Map(selected);
    const cur = next.get(key);
    if (!cur) return;
    next.set(key, { ...cur, [field]: value });
    setSelected(next);
  };

  const totalWeight = Array.from(selected.values()).reduce((s, x) => s + x.weight, 0);

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-4 max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold">My Specialty</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Pick your specialty (or a weighted blend). Shapes buyer titles, pain language,
              objections, and jargon the AI uses in every draft.
            </p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading...
            </CardContent>
          </Card>
        )}

        {selected.size > 1 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-3 text-sm">
              <strong>{selected.size} specialties selected</strong> — weights are normalized.
              Currently totaling {totalWeight}. The top-weighted specialty drives primary voice;
              others weave in where natural.
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {specialtyData?.specialties.map((spec) => {
            const pack = specialtyData.packs[spec.key];
            const isSelected = selected.has(spec.key);
            const current = selected.get(spec.key);
            return (
              <Card key={spec.key} className={isSelected ? 'border-primary shadow-sm' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={spec.key}
                        checked={isSelected}
                        onCheckedChange={() => toggleSpecialty(spec.key)}
                        className="mt-1"
                      />
                      <div>
                        <CardTitle className="text-lg">
                          <label htmlFor={spec.key} className="cursor-pointer">
                            {spec.displayName}
                          </label>
                        </CardTitle>
                        <CardDescription>{spec.shortDescription}</CardDescription>
                      </div>
                    </div>
                    {isSelected && <Badge variant="secondary">{current?.weight || 0}%</Badge>}
                  </div>
                </CardHeader>

                {isSelected && (
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Weight (0-100)</Label>
                      <Slider
                        value={[current?.weight || 100]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={(v) => updateField(spec.key, 'weight', v[0])}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Years of experience</Label>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={current?.experienceYears || ''}
                          onChange={(e) =>
                            updateField(
                              spec.key,
                              'experienceYears',
                              e.target.value ? parseInt(e.target.value, 10) : undefined,
                            )
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Your voice / style notes (optional)</Label>
                      <Textarea
                        rows={2}
                        value={current?.personalNotes || ''}
                        onChange={(e) => updateField(spec.key, 'personalNotes', e.target.value)}
                        placeholder="e.g. I keep emails very short, sign off with just my first name"
                      />
                    </div>

                    {pack && (
                      <>
                        <Separator />
                        <div className="text-xs text-muted-foreground space-y-2">
                          <div>
                            <strong className="text-foreground">Target titles:</strong>{' '}
                            {pack.commonBuyerTitles.slice(0, 5).join(', ')}
                            {pack.commonBuyerTitles.length > 5 && '...'}
                          </div>
                          <div>
                            <strong className="text-foreground">Buyer pains:</strong>
                            <ul className="list-disc pl-5 mt-1 space-y-0.5">
                              {pack.commonPains.slice(0, 3).map((p) => (
                                <li key={p}>{p}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <strong className="text-foreground">Signal triggers:</strong>{' '}
                            {pack.triggerSignals.slice(0, 3).join('; ')}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
