import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  CheckCircle,
  TrendingUp,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Shield,
  Printer,
  Settings,
  Activity,
  Zap
} from "lucide-react";

const Interactive3DHero = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        setMousePosition({
          x: (e.clientX - centerX) / rect.width,
          y: (e.clientY - centerY) / rect.height,
        });
      }
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 3D Office Equipment Data
  const officeEquipment = [
    { id: 1, name: "Canon MF645Cx", status: "active", efficiency: 94, x: 20, y: 30, z: 0 },
    { id: 2, name: "HP M855dn", status: "maintenance", efficiency: 78, x: 70, y: 45, z: -20 },
    { id: 3, name: "Xerox VersaLink", status: "active", efficiency: 89, x: 45, y: 65, z: 10 },
    { id: 4, name: "Ricoh IM C3000", status: "active", efficiency: 92, x: 85, y: 25, z: -10 },
  ];

  const floatingMetrics = [
    { icon: TrendingUp, label: "95% Billing Accuracy", value: "↑ 15%", color: "blue", delay: 0 },
    { icon: Shield, label: "Uptime Guarantee", value: "99.9%", color: "orange", delay: 400 },
  ];

  return (
    <section 
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-white"
      style={{
        transform: `translateY(${scrollY * 0.5}px)`,
      }}
    >
      {/* Animated 3D Background Grid */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div 
          className="absolute inset-0 bg-grid-pattern"
          style={{
            transform: `perspective(1000px) rotateX(60deg) translateZ(-100px) translate(${mousePosition.x * 50}px, ${mousePosition.y * 30}px)`,
            backgroundImage: `
              linear-gradient(to right, #2563eb 1px, transparent 1px),
              linear-gradient(to bottom, #2563eb 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            animation: 'gridFloat 20s ease-in-out infinite',
          }}
        />
      </div>

      {/* Floating 3D Office Environment */}
      <div className="absolute inset-0">
        {/* 3D Room Container */}
        <div 
          className="absolute inset-0"
          style={{
            transform: `perspective(1500px) rotateX(${5 + mousePosition.y * 10}deg) rotateY(${mousePosition.x * 15}deg)`,
          }}
        >
          {/* Office Floor */}
          <div 
            className="absolute bottom-0 left-1/2 w-[800px] h-[600px] -translate-x-1/2"
            style={{
              background: `linear-gradient(135deg, 
                rgba(37, 99, 235, 0.05) 0%, 
                rgba(59, 130, 246, 0.08) 50%, 
                rgba(37, 99, 235, 0.05) 100%)`,
              transform: 'rotateX(90deg) translateZ(-300px)',
              borderRadius: '20px',
            }}
          />

          {/* Copier Equipment with Real-time Data */}
          {officeEquipment.map((equipment, index) => (
            <div
              key={equipment.id}
              className={`absolute transition-all duration-1000 delay-${index * 200}`}
              style={{
                left: `${equipment.x}%`,
                top: `${equipment.y}%`,
                transform: `
                  translateZ(${equipment.z}px) 
                  translateX(${mousePosition.x * 20}px) 
                  translateY(${mousePosition.y * 15}px)
                  ${isVisible ? 'scale(1) opacity-1' : 'scale(0.8) opacity-0'}
                `,
              }}
            >
              {/* 3D Copier Unit */}
              <div className="group relative cursor-pointer">
                <div 
                  className={`
                    relative w-16 h-20 bg-gradient-to-b from-gray-200 to-gray-300 
                    rounded-lg shadow-xl transform transition-all duration-300 
                    hover:scale-110 hover:shadow-2xl
                    ${equipment.status === 'maintenance' ? 'animate-pulse' : ''}
                  `}
                  style={{
                    boxShadow: `
                      0 20px 40px rgba(0,0,0,0.1),
                      inset 0 1px 0 rgba(255,255,255,0.6),
                      inset 0 -1px 0 rgba(0,0,0,0.1)
                    `,
                  }}
                >
                  <div className="absolute top-2 left-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-400 rounded"></div>
                  
                  {/* Status Indicator */}
                  <div className={`
                    absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full
                    ${equipment.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'}
                    animate-ping
                  `}></div>
                </div>

                {/* Floating Data Overlay */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-white/20">
                    <div className="text-xs font-semibold text-gray-900">{equipment.name}</div>
                    <div className="text-xs text-gray-600">Efficiency: {equipment.efficiency}%</div>
                    <div className={`text-xs font-medium ${
                      equipment.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {equipment.status === 'active' ? 'Online' : 'Maintenance'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Floating Metrics Cards */}
        {floatingMetrics.map((metric, index) => (
          <div
            key={index}
            className={`
              absolute transition-all duration-1000 delay-${metric.delay}
              ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}
            `}
            style={{
              left: `${20 + (index % 2) * 60}%`,
              top: `${20 + Math.floor(index / 2) * 45}%`,
              transform: `
                translateZ(${50 + index * 20}px) 
                translateX(${mousePosition.x * -30}px) 
                translateY(${mousePosition.y * -20}px)
              `,
            }}
          >
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-300 group">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-${metric.color}-500/20`}>
                  <metric.icon className={`w-4 h-4 text-${metric.color}-600`} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{metric.value}</div>
                  <div className="text-xs text-gray-600">{metric.label}</div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Interactive Particle System */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-40"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `particleFloat ${8 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 4}s`,
                transform: `translateX(${mousePosition.x * 100}px) translateY(${mousePosition.y * 50}px)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div
            className={`transform transition-all duration-1000 ${
              isVisible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'
            }`}
          >
            <Badge className="mb-4 bg-blue-100 text-blue-900 border-blue-300">
              Coming October 1st, 2025
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Unify Your
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {" "}Copier Business
              </span>
            </h1>

            <p className="text-xl text-gray-700 mb-8 leading-relaxed">
              Experience the future of copier dealer management with our intelligent 3D monitoring system. 
              Watch your equipment performance in real-time and optimize operations with AI-powered insights.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-lg px-8 py-6 opacity-75 cursor-not-allowed"
                disabled
              >
                Coming October 1st
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 border-gray-300 hover:bg-gray-50 opacity-75 cursor-not-allowed"
                disabled
              >
                Get Notified
              </Button>
            </div>

            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                3D Equipment Monitoring
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Real-time Analytics
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                Predictive Maintenance
              </div>
            </div>
          </div>

          {/* Right 3D Interactive Dashboard */}
          <div
            className={`transform transition-all duration-1000 delay-300 ${
              isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'
            }`}
          >
            <div 
              className="relative"
              style={{
                transform: `perspective(1000px) rotateY(${mousePosition.x * -10}deg) rotateX(${mousePosition.y * 5}deg)`,
              }}
            >
              {/* Glowing Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl blur-3xl opacity-20 animate-pulse scale-105"></div>
              
              {/* Main Dashboard */}
              <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 transform hover:scale-105 transition-transform duration-500">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-semibold text-gray-900">
                      Fleet Command Center
                    </h3>
                    <Badge className="bg-green-100 text-green-800 animate-pulse">
                      Live 3D
                    </Badge>
                  </div>

                  {/* Real-time Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-blue-700 font-medium">Fleet Efficiency</p>
                          <p className="text-3xl font-bold text-blue-900">89.3%</p>
                        </div>
                        <Activity className="h-10 w-10 text-blue-600" />
                      </div>
                      <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full w-[89%] animate-pulse"></div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-700 font-medium">Active Units</p>
                          <p className="text-3xl font-bold text-green-900">247</p>
                        </div>
                        <Zap className="h-10 w-10 text-green-600" />
                      </div>
                      <p className="text-xs text-green-600 mt-1">↑ 12% from last month</p>
                    </div>
                  </div>

                  {/* 3D Visualization Preview */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-700 font-medium mb-3">3D Equipment Overview</p>
                    
                    <div className="flex items-center justify-center space-x-4 py-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="relative">
                          <div 
                            className={`w-8 h-10 bg-gradient-to-b from-gray-300 to-gray-400 rounded transform hover:scale-110 transition-transform cursor-pointer`}
                            style={{
                              animation: `bounce ${1 + i * 0.2}s ease-in-out infinite`,
                            }}
                          />
                          <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full animate-ping`}></div>
                        </div>
                      ))}
                    </div>
                    
                    <p className="text-xs text-gray-500 text-center">
                      Interactive 3D fleet monitoring
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes gridFloat {
          0%, 100% { transform: perspective(1000px) rotateX(60deg) translateZ(-100px) translateY(0px); }
          50% { transform: perspective(1000px) rotateX(60deg) translateZ(-100px) translateY(-20px); }
        }
        
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.4; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.8; }
        }
        
        @keyframes bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </section>
  );
};

export default Interactive3DHero;