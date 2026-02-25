/**
 * Fulfillment Tracker
 *
 * FN-005: Shows order fulfillment status timeline with delivery tracking.
 */

import { CheckCircle, Circle, Truck, Package, Clock, MapPin } from 'lucide-react';

export interface FulfillmentStep {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  timestamp?: string;
  description?: string;
}

interface FulfillmentTrackerProps {
  steps: FulfillmentStep[];
  trackingNumber?: string;
  estimatedDelivery?: string;
}

export function FulfillmentTracker({
  steps,
  trackingNumber,
  estimatedDelivery,
}: FulfillmentTrackerProps) {
  return (
    <div className="space-y-4">
      {(trackingNumber || estimatedDelivery) && (
        <div className="flex items-center gap-4 text-sm">
          {trackingNumber && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <Truck className="h-4 w-4" />
              <span>
                Tracking: <strong>{trackingNumber}</strong>
              </span>
            </div>
          )}
          {estimatedDelivery && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>
                ETA: <strong>{new Date(estimatedDelivery).toLocaleDateString()}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-start">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const StepIcon =
            step.status === 'completed' ? CheckCircle : step.status === 'current' ? Clock : Circle;

          return (
            <div key={step.id} className={`flex-1 ${!isLast ? 'pr-4' : ''}`}>
              <div className="flex items-center">
                <div
                  className={`flex-shrink-0 ${
                    step.status === 'completed'
                      ? 'text-green-600'
                      : step.status === 'current'
                        ? 'text-blue-600'
                        : 'text-gray-300'
                  }`}
                >
                  <StepIcon className="h-6 w-6" />
                </div>
                {!isLast && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
              <div className="mt-2">
                <p
                  className={`text-xs font-medium ${
                    step.status === 'pending' ? 'text-gray-400' : 'text-gray-900'
                  }`}
                >
                  {step.label}
                </p>
                {step.timestamp && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(step.timestamp).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
