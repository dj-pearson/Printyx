import React, { useState, useEffect } from "react";
import { createContext7 } from "context7";

// Test monitoring context
const TestMonitorContext = createContext7({
  state: {
    isConnected: false,
    isRunning: false,
    currentRoute: null,
    currentViewport: null,
    progress: {
      current: 0,
      total: 0,
      percentage: 0,
    },
    results: {
      summary: {
        totalRoutes: 0,
        successful: 0,
        errors: 0,
        warnings: 0,
      },
      routes: [],
      recentRoutes: [],
    },
    realTimeErrors: [],
    realTimeWarnings: [],
    connectionStatus: "disconnected",
  },

  actions: {
    connect: (context, wsUrl) => {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        context.setState({
          isConnected: true,
          connectionStatus: "connected",
        });
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        context.handleMessage(message);
      };

      ws.onclose = () => {
        context.setState({
          isConnected: false,
          connectionStatus: "disconnected",
        });
      };

      ws.onerror = () => {
        context.setState({
          connectionStatus: "error",
        });
      };

      return ws;
    },

    handleMessage: (context, message) => {
      switch (message.type) {
        case "initialState":
          context.setState(message.data);
          break;

        case "progress":
          context.setState({
            progress: {
              current: message.data.current,
              total: message.data.total,
              percentage: message.data.percentage,
            },
            currentRoute: message.data.route,
            currentViewport: message.data.viewport,
          });
          break;

        case "routeComplete":
          const routeResult = message.data;
          const currentState = context.getState();

          // Update results
          const updatedRoutes = [...currentState.results.routes, routeResult];
          const recentRoutes = updatedRoutes.slice(-10); // Keep last 10

          // Update summary
          const summary = {
            totalRoutes: updatedRoutes.length,
            successful: updatedRoutes.filter((r) => r.status === "success")
              .length,
            errors: updatedRoutes.filter((r) => r.status === "error").length,
            warnings: updatedRoutes.filter((r) => r.status === "warning")
              .length,
          };

          context.setState({
            results: {
              ...currentState.results,
              summary,
              routes: updatedRoutes,
              recentRoutes,
            },
          });

          // Add real-time errors/warnings
          if (routeResult.errors && routeResult.errors.length > 0) {
            context.setState({
              realTimeErrors: [
                ...currentState.realTimeErrors.slice(-20), // Keep last 20
                ...routeResult.errors.map((err) => ({
                  route: routeResult.route,
                  message: err,
                  timestamp: new Date(),
                })),
              ],
            });
          }

          if (routeResult.warnings && routeResult.warnings.length > 0) {
            context.setState({
              realTimeWarnings: [
                ...currentState.realTimeWarnings.slice(-20), // Keep last 20
                ...routeResult.warnings.map((warn) => ({
                  route: routeResult.route,
                  message: warn,
                  timestamp: new Date(),
                })),
              ],
            });
          }
          break;

        case "error":
          const currentErrors = context.getState().realTimeErrors;
          context.setState({
            realTimeErrors: [
              ...currentErrors.slice(-20),
              {
                route: context.getState().currentRoute,
                message: message.data.message || message.data,
                timestamp: new Date(),
              },
            ],
          });
          break;
      }
    },
  },
});

interface TestMonitorProps {
  wsUrl?: string;
  autoConnect?: boolean;
}

export const TestMonitor: React.FC<TestMonitorProps> = ({
  wsUrl = "ws://localhost:8080/test-monitor",
  autoConnect = true,
}) => {
  const [context] = useState(() => TestMonitorContext);
  const [state, setState] = useState(context.getState());
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Subscribe to context changes
  useEffect(() => {
    const unsubscribe = context.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [context]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && !ws) {
      handleConnect();
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [autoConnect]);

  const handleConnect = () => {
    try {
      const websocket = context.actions.connect(wsUrl);
      setWs(websocket);
    } catch (error) {
      console.error("Failed to connect to test monitor:", error);
    }
  };

  const handleDisconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-600";
      case "disconnected":
        return "text-gray-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getRouteStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      default:
        return "⏳";
    }
  };

  return (
    <div className="test-monitor p-6 bg-white rounded-lg shadow-lg">
      <div className="header mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">🧪 Test Monitor</h2>

          <div className="flex items-center gap-4">
            <div className="connection-status flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  state.connectionStatus === "connected"
                    ? "bg-green-500"
                    : state.connectionStatus === "error"
                    ? "bg-red-500"
                    : "bg-gray-400"
                }`}
              ></div>
              <span
                className={`text-sm ${getStatusColor(state.connectionStatus)}`}
              >
                {state.connectionStatus}
              </span>
            </div>

            {!state.isConnected ? (
              <button
                onClick={handleConnect}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Connect
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {state.isRunning && (
          <div className="progress-section mb-4">
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-gray-600">
                Testing: {state.currentRoute} ({state.currentViewport})
              </div>
              <div className="text-sm font-medium">
                {state.progress.current} / {state.progress.total} (
                {state.progress.percentage}%)
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.progress.percentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="summary-grid grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-blue-700">
            {state.results.summary.totalRoutes}
          </div>
          <div className="text-sm text-blue-600">Total Routes</div>
        </div>

        <div className="bg-green-50 p-4 rounded border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-700">
            {state.results.summary.successful}
          </div>
          <div className="text-sm text-green-600">Successful</div>
        </div>

        <div className="bg-red-50 p-4 rounded border-l-4 border-red-500">
          <div className="text-2xl font-bold text-red-700">
            {state.results.summary.errors}
          </div>
          <div className="text-sm text-red-600">Errors</div>
        </div>

        <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-yellow-700">
            {state.results.summary.warnings}
          </div>
          <div className="text-sm text-yellow-600">Warnings</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Routes */}
        <div className="recent-routes">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            📋 Recent Routes
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state.results.recentRoutes.map((route, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div className="flex items-center gap-2">
                  <span>{getRouteStatusIcon(route.status)}</span>
                  <span className="font-mono text-sm">{route.route}</span>
                  <span className="text-xs text-gray-500">
                    ({route.viewport})
                  </span>
                </div>
                <div className="text-xs text-gray-600">{route.loadTime}ms</div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Issues */}
        <div className="real-time-issues">
          <h3 className="text-lg font-semibold mb-3 text-gray-800">
            🚨 Live Issues
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {/* Errors */}
            {state.realTimeErrors.slice(-5).map((error, index) => (
              <div
                key={`error-${index}`}
                className="p-3 bg-red-50 border-l-4 border-red-500 rounded"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-mono text-sm text-red-700">
                      {error.route}
                    </div>
                    <div className="text-sm text-red-600">{error.message}</div>
                  </div>
                  <div className="text-xs text-red-500">
                    {error.timestamp?.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Warnings */}
            {state.realTimeWarnings.slice(-3).map((warning, index) => (
              <div
                key={`warning-${index}`}
                className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-mono text-sm text-yellow-700">
                      {warning.route}
                    </div>
                    <div className="text-sm text-yellow-600">
                      {warning.message}
                    </div>
                  </div>
                  <div className="text-xs text-yellow-500">
                    {warning.timestamp?.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="actions mt-6 flex gap-4">
        <button
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          onClick={() =>
            window.open("./test-results/test-report.html", "_blank")
          }
        >
          📊 View Full Report
        </button>

        <button
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          onClick={() => {
            const data = JSON.stringify(state.results, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "test-results.json";
            a.click();
          }}
        >
          💾 Download Results
        </button>

        <button
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          onClick={() =>
            window.open("./test-results/actionable-report.json", "_blank")
          }
        >
          🎯 Action Items
        </button>
      </div>
    </div>
  );
};

export default TestMonitor;
