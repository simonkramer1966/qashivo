import { Button } from "@/components/ui/button";
import splashImage from "@assets/stock_images/financial_technology_0d743e1b.jpg";
import nexusLogo from "@assets/Main Nexus Logo copy_1756923544828.png";

interface SplashScreenProps {
  onEnter: () => void;
}

export default function SplashScreen({ onEnter }: SplashScreenProps) {
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      data-testid="splash-screen"
    >
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${splashImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#17B6C3]/90 via-slate-900/80 to-black/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-8 px-4 text-center">
        {/* Logo */}
        <div className="animate-fade-in">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
            <img 
              src={nexusLogo} 
              alt="Qashivo" 
              className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
            />
          </div>
        </div>

        {/* Brand Name */}
        <div className="animate-fade-in-delay-1">
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-2 tracking-tight">
            Qashivo
          </h1>
          <p className="text-lg sm:text-xl text-white/90 font-light tracking-wide">
            Cashflow Simplified
          </p>
        </div>

        {/* Tagline */}
        <div className="animate-fade-in-delay-2">
          <p className="text-sm sm:text-base text-white/70 max-w-md px-4">
            Intelligent accounts receivable, cashflow and debtor financing platform for modern businesses
          </p>
        </div>

        {/* Enter Button */}
        <div className="animate-fade-in-delay-3 pt-4">
          <Button
            onClick={onEnter}
            size="lg"
            className="bg-white text-[#17B6C3] hover:bg-white/90 hover:scale-105 transition-all duration-200 shadow-2xl px-12 py-6 text-lg font-semibold rounded-xl"
            data-testid="button-enter"
          >
            Enter
          </Button>
        </div>

        {/* Footer Info */}
        <div className="animate-fade-in-delay-4 pt-8">
          <p className="text-xs sm:text-sm text-white/50">
            Click the logo or inactive for 60 seconds to lock screen
          </p>
        </div>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#17B6C3]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
    </div>
  );
}
