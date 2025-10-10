import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Mail, Settings, LogOut } from "lucide-react";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout?: () => void;
}

export default function UserProfileDialog({ open, onOpenChange, onLogout }: UserProfileDialogProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const getUserName = () => {
    const firstName = (user as any)?.firstName;
    const lastName = (user as any)?.lastName;
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if ((user as any)?.email) {
      return (user as any).email;
    }
    return "User";
  };

  const getUserInitials = () => {
    const firstName = (user as any)?.firstName || "";
    const lastName = (user as any)?.lastName || "";
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`;
    }
    if ((user as any)?.email) {
      return (user as any).email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const handleSettingsClick = () => {
    onOpenChange(false);
    setLocation('/settings');
  };

  const handleLogoutClick = () => {
    onOpenChange(false);
    onLogout?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Profile</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* User Avatar and Name */}
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={(user as any)?.profileImageUrl || ""} alt={getUserName()} />
              <AvatarFallback className="bg-[#17B6C3] text-white text-2xl font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            
            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">{getUserName()}</h3>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                <Mail className="h-4 w-4" />
                <span>{(user as any)?.email || ""}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleSettingsClick}
              data-testid="button-go-to-settings"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogoutClick}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
