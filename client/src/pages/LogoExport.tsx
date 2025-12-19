import { Logo } from '@/components/ui/logo';

const LogoExport = () => {
  return (
    <div className="min-h-screen bg-white p-20 flex flex-col gap-20">
      {/* Icon Only - 512x512 container (visual) */}
      <div
        id="icon-export"
        className="flex items-center justify-center p-0"
        style={{ width: '512px', height: '512px', background: 'transparent' }}
      >
        <Logo className="w-full h-full" />
      </div>

      {/* Full Logo - fixed width */}
      <div
        id="logo-export"
        className="flex items-center p-0"
        style={{ width: '1000px', height: '300px', background: 'transparent' }}
      >
        <Logo className="h-[200px] w-[200px]" />
        <span
          className="ml-8 font-bold text-gray-900"
          style={{
            fontSize: '140px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '-2px',
            lineHeight: 1,
          }}
        >
          Printyx
        </span>
      </div>
    </div>
  );
};

export default LogoExport;
