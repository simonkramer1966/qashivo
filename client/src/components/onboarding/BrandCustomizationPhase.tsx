import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  Palette, 
  Upload,
  Eye,
  Loader2
} from "lucide-react";

interface BrandCustomizationPhaseProps {
  onComplete: () => void;
  onUpdate: (data: any) => void;
  isCompleting: boolean;
  phaseData: any;
}

export function BrandCustomizationPhase({ 
  onComplete, 
  onUpdate, 
  isCompleting, 
  phaseData 
}: BrandCustomizationPhaseProps) {
  const { toast } = useToast();
  
  const brandData = phaseData.brand_customization || {};
  
  // Form state
  const [branding, setBranding] = useState(
    brandData.branding || {
      logoUrl: '',
      primaryColor: '#17B6C3',
      secondaryColor: '#1396A1',
      communicationTone: 'professional'
    }
  );

  const [customerExperience, setCustomerExperience] = useState(
    brandData.customerExperience || {
      portalCustomization: true,
      emailBranding: true
    }
  );

  const handleSave = () => {
    const updatedData = {
      brand_customization: {
        branding,
        customerExperience
      }
    };
    
    onUpdate(updatedData);
    toast({
      title: "Brand Customization Saved",
      description: "Your branding preferences have been saved."
    });
  };

  const canComplete = branding.communicationTone;

  return (
    <div className="space-y-6" data-testid="brand-customization-phase">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Customize Your Brand Experience</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Make the collections experience feel like your brand. This helps maintain customer relationships 
          while improving payment outcomes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Visual Branding */}
        <Card className="bg-white/70 backdrop-blur-md border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#17B6C3]" />
              Visual Branding
            </CardTitle>
            <CardDescription>
              Customize colors and logo for customer communications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Logo Upload */}
            <div className="space-y-3">
              <Label>Company Logo</Label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-[#17B6C3] transition-colors">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">Upload your logo</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
                >
                  Choose File
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  PNG, JPG up to 2MB. Recommended: 200x60px
                </p>
              </div>
            </div>

            {/* Color Scheme */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding((prev: typeof branding) => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-12 h-10 p-1 border border-gray-200"
                  />
                  <Input
                    type="text"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding((prev: typeof branding) => ({ ...prev, primaryColor: e.target.value }))}
                    className="bg-white/70 border-gray-200/30"
                    placeholder="#17B6C3"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={branding.secondaryColor}
                    onChange={(e) => setBranding((prev: typeof branding) => ({ ...prev, secondaryColor: e.target.value }))}
                    className="w-12 h-10 p-1 border border-gray-200"
                  />
                  <Input
                    type="text"
                    value={branding.secondaryColor}
                    onChange={(e) => setBranding((prev: typeof branding) => ({ ...prev, secondaryColor: e.target.value }))}
                    className="bg-white/70 border-gray-200/30"
                    placeholder="#1396A1"
                  />
                </div>
              </div>
            </div>

            {/* Color Preview */}
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <h4 className="text-sm font-medium mb-3">Preview</h4>
              <div className="space-y-2">
                <div 
                  className="h-3 rounded"
                  style={{ backgroundColor: branding.primaryColor }}
                />
                <div 
                  className="h-3 rounded"
                  style={{ backgroundColor: branding.secondaryColor }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Communication Style */}
        <Card className="bg-white/70 backdrop-blur-md border-white/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#17B6C3]" />
              Communication Style
            </CardTitle>
            <CardDescription>
              Set the tone for automated communications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Communication Tone */}
            <div className="space-y-4">
              <Label>Communication Tone</Label>
              <RadioGroup 
                value={branding.communicationTone} 
                onValueChange={(value) => setBranding((prev: typeof branding) => ({ ...prev, communicationTone: value }))}
              >
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200">
                    <RadioGroupItem value="professional" id="professional" className="mt-1" />
                    <div>
                      <Label htmlFor="professional" className="font-medium">Professional</Label>
                      <p className="text-sm text-gray-600">
                        Formal and business-like tone. Best for B2B relationships.
                      </p>
                      <p className="text-xs text-gray-500 mt-1 italic">
                        "We kindly request payment for invoice #12345..."
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200">
                    <RadioGroupItem value="friendly" id="friendly" className="mt-1" />
                    <div>
                      <Label htmlFor="friendly" className="font-medium">Friendly</Label>
                      <p className="text-sm text-gray-600">
                        Warm and approachable. Great for small businesses and B2C.
                      </p>
                      <p className="text-xs text-gray-500 mt-1 italic">
                        "Hi there! Just a friendly reminder about invoice #12345..."
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg border border-gray-200">
                    <RadioGroupItem value="firm" id="firm" className="mt-1" />
                    <div>
                      <Label htmlFor="firm" className="font-medium">Firm</Label>
                      <p className="text-sm text-gray-600">
                        Direct and assertive. For overdue accounts requiring urgency.
                      </p>
                      <p className="text-xs text-gray-500 mt-1 italic">
                        "Payment for invoice #12345 is now overdue..."
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Customer Experience Options */}
            <div className="space-y-4">
              <h4 className="font-medium">Customer Experience</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <Label htmlFor="portal-customization" className="font-medium">
                      Customer Portal Branding
                    </Label>
                    <p className="text-sm text-gray-600">
                      Apply your branding to the customer payment portal
                    </p>
                  </div>
                  <Switch
                    id="portal-customization"
                    checked={customerExperience.portalCustomization}
                    onCheckedChange={(checked) => 
                      setCustomerExperience((prev: typeof customerExperience) => ({ ...prev, portalCustomization: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <Label htmlFor="email-branding" className="font-medium">
                      Email Template Branding
                    </Label>
                    <p className="text-sm text-gray-600">
                      Include your logo and colors in email communications
                    </p>
                  </div>
                  <Switch
                    id="email-branding"
                    checked={customerExperience.emailBranding}
                    onCheckedChange={(checked) => 
                      setCustomerExperience((prev: typeof customerExperience) => ({ ...prev, emailBranding: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save and Complete */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleSave}
          className="border-[#17B6C3]/20 text-[#17B6C3] hover:bg-[#17B6C3]/5"
        >
          Save Changes
        </Button>

        <Button 
          onClick={onComplete}
          disabled={!canComplete || isCompleting}
          className="bg-green-600 hover:bg-green-700 text-white"
          data-testid="button-complete-brand-phase"
        >
          {isCompleting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          )}
          Complete Brand Customization
        </Button>
      </div>
    </div>
  );
}