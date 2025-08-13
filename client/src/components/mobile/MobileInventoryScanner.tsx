import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Package, 
  QrCode, 
  Camera, 
  Search,
  Plus,
  Minus,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Clock,
  BarChart3
} from "lucide-react";
import { useMobileScanning } from "@/hooks/useExternalIntegrations";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  partNumber: string;
  name: string;
  description: string;
  category: string;
  location: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  lastUpdated: string;
}

interface ScanResult {
  partNumber: string;
  action: 'add' | 'remove' | 'count' | 'locate';
  quantity?: number;
  location?: string;
}

export function MobileInventoryScanner() {
  const [scanMode, setScanMode] = useState<'barcode' | 'qr' | 'text'>('barcode');
  const [scanAction, setScanAction] = useState<'add' | 'remove' | 'count' | 'locate'>('add');
  const [scannedItems, setScannedItems] = useState<ScanResult[]>([]);
  const [currentItem, setCurrentItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const scanner = useMobileScanning();
  const { toast } = useToast();

  // Mock inventory data
  const mockInventory: InventoryItem[] = [
    {
      id: '1',
      partNumber: 'TONER-C5860-BK',
      name: 'Black Toner Cartridge',
      description: 'Canon imageRUNNER ADVANCE DX C5860i Black Toner',
      category: 'Toner',
      location: 'A-1-15',
      currentStock: 24,
      minStock: 5,
      maxStock: 50,
      unitPrice: 89.99,
      lastUpdated: new Date().toISOString()
    },
    {
      id: '2',
      partNumber: 'DRUM-C5860-COLOR',
      name: 'Color Drum Unit',
      description: 'Canon imageRUNNER ADVANCE DX C5860i Color Drum',
      category: 'Drum',
      location: 'A-2-08',
      currentStock: 8,
      minStock: 3,
      maxStock: 20,
      unitPrice: 249.99,
      lastUpdated: new Date().toISOString()
    }
  ];

  useEffect(() => {
    if (scanner.scanResult) {
      handleScanResult(scanner.scanResult);
    }
  }, [scanner.scanResult]);

  const handleScanResult = (result: string) => {
    // Find item by part number
    const item = mockInventory.find(item => 
      item.partNumber === result || item.id === result
    );

    if (item) {
      setCurrentItem(item);
      toast({
        title: "Item Found",
        description: `Scanned: ${item.name}`
      });
    } else {
      toast({
        title: "Item Not Found",
        description: `Part number ${result} not in inventory`,
        variant: "destructive"
      });
    }
  };

  const handleStartScan = async () => {
    try {
      await scanner.startScan(scanMode);
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Unable to access camera. Check permissions.",
        variant: "destructive"
      });
    }
  };

  const handleInventoryAction = () => {
    if (!currentItem) return;

    const scanResult: ScanResult = {
      partNumber: currentItem.partNumber,
      action: scanAction,
      quantity: ['add', 'remove', 'count'].includes(scanAction) ? quantity : undefined,
      location: scanAction === 'locate' ? currentItem.location : undefined
    };

    setScannedItems(prev => [...prev, scanResult]);
    
    toast({
      title: `${scanAction.charAt(0).toUpperCase() + scanAction.slice(1)} Recorded`,
      description: `${currentItem.name}: ${quantity} units`
    });

    // Reset for next scan
    setCurrentItem(null);
    setQuantity(1);
  };

  const getStockStatusColor = (current: number, min: number, max: number) => {
    if (current <= min) return 'text-red-600 bg-red-50';
    if (current <= min * 1.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getStockStatusText = (current: number, min: number) => {
    if (current <= min) return 'LOW STOCK';
    if (current <= min * 1.5) return 'WARNING';
    return 'IN STOCK';
  };

  return (
    <div className="space-y-4">
      {/* Scanner Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Inventory Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scan Mode Selection */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant={scanMode === 'barcode' ? 'default' : 'outline'}
              onClick={() => setScanMode('barcode')}
            >
              Barcode
            </Button>
            <Button
              size="sm"
              variant={scanMode === 'qr' ? 'default' : 'outline'}
              onClick={() => setScanMode('qr')}
            >
              QR Code
            </Button>
            <Button
              size="sm"
              variant={scanMode === 'text' ? 'default' : 'outline'}
              onClick={() => setScanMode('text')}
            >
              Text OCR
            </Button>
          </div>

          {/* Action Selection */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={scanAction === 'add' ? 'default' : 'outline'}
              onClick={() => setScanAction('add')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Stock
            </Button>
            <Button
              size="sm"
              variant={scanAction === 'remove' ? 'default' : 'outline'}
              onClick={() => setScanAction('remove')}
            >
              <Minus className="h-4 w-4 mr-1" />
              Remove Stock
            </Button>
            <Button
              size="sm"
              variant={scanAction === 'count' ? 'default' : 'outline'}
              onClick={() => setScanAction('count')}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Cycle Count
            </Button>
            <Button
              size="sm"
              variant={scanAction === 'locate' ? 'default' : 'outline'}
              onClick={() => setScanAction('locate')}
            >
              <MapPin className="h-4 w-4 mr-1" />
              Locate Item
            </Button>
          </div>

          {/* Scanner Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleStartScan}
            disabled={scanner.isScanning}
          >
            {scanner.isScanning ? (
              <>
                <Camera className="h-5 w-5 mr-2 animate-pulse" />
                Scanning...
              </>
            ) : (
              <>
                <QrCode className="h-5 w-5 mr-2" />
                Start Scan
              </>
            )}
          </Button>

          {!scanner.isSupported && (
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 mx-auto text-yellow-600 mb-2" />
              <p className="text-sm text-yellow-700">
                Camera scanning not available. Use manual search below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Manual Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter part number or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => {
                const item = mockInventory.find(item => 
                  item.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.name.toLowerCase().includes(searchTerm.toLowerCase())
                );
                if (item) {
                  setCurrentItem(item);
                  toast({ title: "Item Found", description: item.name });
                } else {
                  toast({ title: "Not Found", description: "No matching items", variant: "destructive" });
                }
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Item */}
      {currentItem && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-lg">{currentItem.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label>Part Number</Label>
                <p className="font-mono">{currentItem.partNumber}</p>
              </div>
              <div>
                <Label>Category</Label>
                <p>{currentItem.category}</p>
              </div>
              <div>
                <Label>Location</Label>
                <p className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {currentItem.location}
                </p>
              </div>
              <div>
                <Label>Current Stock</Label>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{currentItem.currentStock}</span>
                  <Badge className={getStockStatusColor(currentItem.currentStock, currentItem.minStock, currentItem.maxStock)}>
                    {getStockStatusText(currentItem.currentStock, currentItem.minStock)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-center w-20"
                    min="1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleInventoryAction}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {scanAction === 'add' && `Add ${quantity} to Inventory`}
                {scanAction === 'remove' && `Remove ${quantity} from Inventory`}
                {scanAction === 'count' && `Update Count to ${quantity}`}
                {scanAction === 'locate' && `Locate Item`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      {scannedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Actions ({scannedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scannedItems.slice(-5).reverse().map((scan, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{scan.partNumber}</div>
                    <div className="text-xs text-gray-500">
                      {scan.action.toUpperCase()}
                      {scan.quantity && ` - Qty: ${scan.quantity}`}
                      {scan.location && ` - Location: ${scan.location}`}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {new Date().toLocaleTimeString()}
                  </Badge>
                </div>
              ))}
            </div>
            
            {scannedItems.length > 0 && (
              <Button
                size="sm"
                className="w-full mt-4"
                onClick={() => {
                  toast({
                    title: "Actions Synced",
                    description: `${scannedItems.length} inventory actions processed`
                  });
                  setScannedItems([]);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Sync All Actions ({scannedItems.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MobileInventoryScanner;