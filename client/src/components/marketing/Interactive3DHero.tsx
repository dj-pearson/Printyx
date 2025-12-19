import { useState, useRef, useEffect } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useMotionTemplate,
} from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  Zap,
  Activity,
  Server,
  Users,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

const Interactive3DHero = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = ({ clientX, clientY }: { clientX: number; clientY: number }) => {
    const { innerWidth, innerHeight } = window;
    const x = clientX / innerWidth - 0.5;
    const y = clientY / innerHeight - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const springConfig = { damping: 25, stiffness: 150 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), springConfig);

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative min-h-[110vh] flex items-center justify-center overflow-hidden bg-slate-950 pt-20 md:pt-0"
      style={{ perspective: '1200px' }}
    >
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

      {/* Animated Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Floating Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 100, 0],
          y: [0, -50, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/30 rounded-full blur-[128px]"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -50, 0],
          y: [0, 100, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[128px]"
      />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ y, opacity }}
            className="relative z-20"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Badge
                variant="outline"
                className="mb-6 px-4 py-1.5 text-sm border-blue-500/30 bg-blue-500/10 text-blue-400 backdrop-blur-sm rounded-full"
              >
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Next-Gen Dealer Management
              </Badge>
            </motion.div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-8 leading-[1.1]">
              Command Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 animate-gradient-x">
                Entire Fleet
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 mb-10 leading-relaxed max-w-xl">
              The first AI-native platform designed to predict failures, automate service workflows,
              and maximize profitability for modern copier dealers.
            </p>

            <div className="flex flex-col sm:flex-row gap-5">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 text-base sm:px-8 sm:py-7 sm:text-lg rounded-xl shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_0_60px_-15px_rgba(37,99,235,0.6)] transition-all duration-300 group"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white px-6 py-4 text-base sm:px-8 sm:py-7 sm:text-lg rounded-xl backdrop-blur-sm"
              >
                Schedule Demo
              </Button>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-6 border-t border-slate-800/50 pt-8">
              {[
                {
                  label: 'Prediction Accuracy',
                  value: '94%',
                  icon: TrendingUp,
                  color: 'text-green-400',
                },
                { label: 'Service Uptime', value: '99.9%', icon: Server, color: 'text-blue-400' },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-lg bg-slate-900/50 border border-slate-800 ${stat.color}`}
                  >
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm text-slate-500">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* 3D Interactive Visual */}
          <div className="relative h-[600px] w-full hidden lg:block perspective-1000">
            <motion.div
              style={{ rotateX, rotateY, z: 100 }}
              className="relative w-full h-full preserve-3d"
            >
              {/* Main Dashboard Card */}
              <motion.div
                initial={{ opacity: 0, y: 100, rotateX: 20 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 1, delay: 0.2, type: 'spring' }}
                className="absolute inset-x-0 top-10 z-20 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
                style={{ transformStyle: 'preserve-3d', transform: 'translateZ(50px)' }}
              >
                {/* Window Controls */}
                <div className="h-10 border-b border-slate-700/50 bg-slate-900/50 flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>

                {/* Dashboard Content */}
                <div className="p-6 grid grid-cols-3 gap-6">
                  {/* Sidebar */}
                  <div className="col-span-1 space-y-4">
                    <div className="h-20 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-medium text-blue-300">System Status</span>
                      </div>
                      <div className="text-lg font-bold text-white">Healthy</div>
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-10 rounded-lg bg-slate-800/50 w-full animate-pulse"
                          style={{ animationDelay: `${i * 0.2}s` }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Main Chart Area */}
                  <div className="col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium text-slate-300">Revenue Forecast</h3>
                      <Badge
                        variant="secondary"
                        className="bg-green-500/10 text-green-400 border-0 text-[10px]"
                      >
                        +12.5%
                      </Badge>
                    </div>
                    <div className="h-32 rounded-xl bg-gradient-to-t from-blue-500/5 to-transparent border-b border-blue-500/20 flex items-end justify-between px-2 pb-2 gap-2">
                      {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                          className="w-full bg-blue-500/40 rounded-t-sm hover:bg-blue-400/60 transition-colors"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Elements (Parallax) */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="absolute -right-12 top-1/4 z-30 bg-slate-800/95 backdrop-blur-md p-4 rounded-xl border border-slate-600 shadow-2xl w-64"
                style={{ transform: 'translateZ(100px)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Critical Alert</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Toner low on Unit #442 (Finance Dept)
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-0 text-xs text-red-400 hover:text-red-300 mt-2"
                    >
                      Dispatch Tech →
                    </Button>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute -left-8 bottom-1/4 z-30 bg-slate-800/95 backdrop-blur-md p-4 rounded-xl border border-slate-600 shadow-2xl w-56"
                style={{ transform: 'translateZ(75px)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-sm font-semibold text-white">Optimization</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Efficiency</span>
                    <span className="text-green-400">98%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '98%' }}
                      transition={{ duration: 1.5, delay: 1 }}
                      className="h-full bg-green-500 rounded-full"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Decorative Elements */}
              <div className="absolute -z-10 inset-0 bg-blue-500/5 blur-3xl rounded-full transform rotate-12 scale-110" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Interactive3DHero;
