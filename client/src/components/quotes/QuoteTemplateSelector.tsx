/**
 * Quote Template Selector
 *
 * QP-003: Select from templates and product bundles for quick quote creation.
 * QP-001: Pre-seed with customer/contact data.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Package, Search, Star, Clock } from 'lucide-react';

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string;
  category: 'template' | 'bundle';
  estimatedValue: number;
  products: { name: string; quantity: number; unitPrice: number }[];
  isPopular?: boolean;
  lastUsed?: string;
}

interface QuoteTemplateSelectorProps {
  templates: QuoteTemplate[];
  onSelect: (template: QuoteTemplate) => void;
  onSkip: () => void;
}

export function QuoteTemplateSelector({ templates, onSelect, onSkip }: QuoteTemplateSelectorProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'template' | 'bundle'>('all');

  const filtered = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || t.category === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Start from a Template</h3>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Start from scratch
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'template', 'bundle'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'template' ? 'Templates' : 'Bundles'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {filtered.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className="text-left p-4 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {template.category === 'bundle' ? (
                  <Package className="h-4 w-4 text-purple-600" />
                ) : (
                  <FileText className="h-4 w-4 text-blue-600" />
                )}
                <span className="font-medium text-sm">{template.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {template.isPopular && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                <Badge variant="secondary" className="text-xs">
                  ${template.estimatedValue.toLocaleString()}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{template.description}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <span>{template.products.length} items</span>
              {template.lastUsed && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last used {new Date(template.lastUsed).toLocaleDateString()}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No templates found</p>
        </div>
      )}
    </div>
  );
}
