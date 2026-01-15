import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './queryClient';

export interface ProductAccessory {
  id: string;
  tenantId: string;
  accessoryCode: string;
  accessoryName: string;
  accessoryType?: string;
  category?: string;
  manufacturer?: string;
  description?: string;
  standardCost?: string;
  standardRepPrice?: string;
  newCost?: string;
  newRepPrice?: string;
  upgradeCost?: string;
  upgradeRepPrice?: string;
  isActive: boolean;
  availableForAll: boolean;
  salesRepCredit: boolean;
  funding: boolean;
  lease: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useRequiredAccessories(modelId: string | null) {
  const { data = [], ...rest } = useQuery<ProductAccessory[]>({
    queryKey: ['/api/product-models', modelId, 'required-accessories'],
    queryFn: async () => {
      if (!modelId) return [];
      const response = await apiRequest(
        `/api/product-models/${modelId}/required-accessories`,
        'GET',
      );
      // Ensure response is always an array
      return Array.isArray(response) ? response : [];
    },
    enabled: !!modelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { data, ...rest };
}

/**
 * Utility function to automatically add required accessories to a quote line items array
 */
export function addRequiredAccessoriesToQuote(
  requiredAccessories: ProductAccessory[],
  existingLineItems: any[],
  modelId: string,
) {
  // Ensure inputs are arrays
  const accessories = Array.isArray(requiredAccessories) ? requiredAccessories : [];
  const lineItems = Array.isArray(existingLineItems) ? existingLineItems : [];

  if (accessories.length === 0) {
    return lineItems;
  }

  const newLineItems = [...lineItems];

  // Check which required accessories are not already in the quote
  const existingAccessoryCodes = new Set(
    lineItems.filter((item) => item.itemType === 'accessory').map((item) => item.productCode),
  );

  // Add missing required accessories
  accessories.forEach((accessory) => {
    if (!existingAccessoryCodes.has(accessory.accessoryCode)) {
      newLineItems.push({
        id: `temp-${Date.now()}-${Math.random()}`,
        itemType: 'accessory',
        productId: accessory.id,
        productCode: accessory.accessoryCode,
        productName: accessory.accessoryName,
        description: accessory.description || accessory.accessoryName,
        category: accessory.category || 'Accessory',
        quantity: 1,
        unitPrice: parseFloat(accessory.newRepPrice || accessory.standardRepPrice || '0'),
        totalPrice: parseFloat(accessory.newRepPrice || accessory.standardRepPrice || '0'),
        isRequired: true, // Mark as required so it can't be easily removed
        addedAutomatically: true, // Track that this was auto-added
      });
    }
  });

  return newLineItems;
}

/**
 * Utility function to get required accessories info for display
 */
export function getRequiredAccessoriesInfo(requiredAccessories: ProductAccessory[]) {
  // Ensure input is an array
  const accessories = Array.isArray(requiredAccessories) ? requiredAccessories : [];

  if (accessories.length === 0) {
    return {
      count: 0,
      totalValue: 0,
      accessories: [],
    };
  }

  const totalValue = accessories.reduce((sum, accessory) => {
    const price = parseFloat(accessory.newRepPrice || accessory.standardRepPrice || '0');
    return sum + price;
  }, 0);

  return {
    count: accessories.length,
    totalValue,
    accessories: accessories.map((accessory) => ({
      code: accessory.accessoryCode,
      name: accessory.accessoryName,
      price: parseFloat(accessory.newRepPrice || accessory.standardRepPrice || '0'),
    })),
  };
}
