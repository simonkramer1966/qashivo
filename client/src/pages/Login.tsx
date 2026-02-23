import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";
import qashivoLogo from "@assets/qashivo_image_1771827289906.png";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/login", data);
      return await res.json();
    },
    onSuccess: async (response: { user: { id: string; email: string; platformAdmin?: boolean; partnerId?: string } }) => {
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      if (response.user?.platformAdmin) {
        setLocation("/admin");
      } else if (response.user?.partnerId) {
        setLocation("/partner");
      } else {
        setLocation("/");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={qashivoLogo} alt="Qashivo" className="h-10 mx-auto mb-6" />
          <h1 className="text-2xl font-semibold text-[#0B0F17] mb-2">Welcome back</h1>
          <p className="text-[#556070] text-sm">Sign in to your account to continue</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#0B0F17] text-sm font-medium">Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="your@email.com"
                      className="bg-white border-[#E6E8EC] text-[#0B0F17] placeholder:text-[#556070]/50 focus:border-[#17B6C3] focus:ring-[#17B6C3]/20 h-11"
                      data-testid="input-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#0B0F17] text-sm font-medium">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="bg-white border-[#E6E8EC] text-[#0B0F17] placeholder:text-[#556070]/50 focus:border-[#17B6C3] focus:ring-[#17B6C3]/20 h-11 pr-10"
                        data-testid="input-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-[#556070] hover:text-[#0B0F17]"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white font-medium h-11 rounded-lg transition-all duration-200"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Form>

        <div className="mt-8 pt-6 border-t border-[#E6E8EC] text-center space-y-3">
          <Button
            variant="link"
            className="text-sm text-[#17B6C3] hover:text-[#1396A1] p-0"
            onClick={() => setLocation("/forgot-password")}
            data-testid="button-forgot-password"
          >
            Forgot your password?
          </Button>
          <div className="text-sm text-[#556070]">
            Don't have an account?{" "}
            <Button
              variant="link"
              className="text-[#17B6C3] hover:text-[#1396A1] p-0"
              onClick={() => setLocation("/signup")}
              data-testid="link-signup"
            >
              Sign up
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
