import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const acceptSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptForm = z.infer<typeof acceptSchema>;

interface InviteInfo {
  valid: boolean;
  email?: string;
  role?: string;
  tenantName?: string;
  message?: string;
}

export default function AcceptUserInvite() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const params = new URLSearchParams(search);
  const token = params.get("token");

  const { data: inviteInfo, isLoading } = useQuery<InviteInfo>({
    queryKey: ["/api/rbac/invitations/verify", token],
    queryFn: async () => {
      const res = await fetch(`/api/rbac/invitations/verify?token=${token}`);
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const form = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (data: AcceptForm) => {
      const res = await apiRequest("POST", "/api/rbac/invitations/accept", {
        inviteToken: token,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
      });
      return await res.json();
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Account created",
        description: response.message || "Welcome to Qashivo!",
      });
      setLocation(response.redirect || "/");
    },
    onError: (error: any) => {
      toast({
        title: "Something went wrong",
        description: error.message || "Failed to create your account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AcceptForm) => {
    acceptMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <AlertCircle className="h-10 w-10 text-[#E54545] mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-[#0B0F17] mb-2">Invalid Link</h1>
          <p className="text-sm text-[#556070]">
            This invitation link is invalid. Please check the link in your email.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-6 w-6 text-[#17B6C3] animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#556070]">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (!inviteInfo?.valid) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <AlertCircle className="h-10 w-10 text-[#E54545] mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-[#0B0F17] mb-2">Invitation Expired</h1>
          <p className="text-sm text-[#556070]">
            This invitation is no longer valid. It may have already been used or has expired. Please contact your administrator for a new invitation.
          </p>
        </div>
      </div>
    );
  }

  const roleLabelMap: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    accountant: "Accountant",
    manager: "Manager",
    credit_controller: "Credit Controller",
    readonly: "Read Only",
  };
  const roleLabel = roleLabelMap[inviteInfo.role || "credit_controller"] || inviteInfo.role;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs font-medium tracking-wide uppercase text-[#17B6C3] mb-3">Qashivo</p>
          <h1 className="text-xl font-semibold text-[#0B0F17] mb-2">
            Join {inviteInfo.tenantName}
          </h1>
          <p className="text-sm text-[#556070] leading-relaxed">
            You've been invited as <span className="font-medium text-[#0B0F17]">{roleLabel}</span>. Set up your account below.
          </p>
        </div>

        <div className="mb-6 py-3 px-4 bg-[#F7F8FA] border border-[#E6E8EC] rounded">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#556070]">Email:</span>
            <span className="font-medium text-[#0B0F17]">{inviteInfo.email}</span>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#0B0F17] text-xs font-medium">First name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="First name"
                        className="bg-white border-[#E6E8EC] text-[#0B0F17] placeholder:text-[#8C95A3] focus:border-[#17B6C3] focus:ring-[#17B6C3]/20 h-10 text-sm"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#0B0F17] text-xs font-medium">Last name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Last name"
                        className="bg-white border-[#E6E8EC] text-[#0B0F17] placeholder:text-[#8C95A3] focus:border-[#17B6C3] focus:ring-[#17B6C3]/20 h-10 text-sm"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#0B0F17] text-xs font-medium">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        className="bg-white border-[#E6E8EC] text-[#0B0F17] placeholder:text-[#8C95A3] focus:border-[#17B6C3] focus:ring-[#17B6C3]/20 h-10 text-sm pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C95A3] hover:text-[#556070]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#0B0F17] text-xs font-medium">Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      placeholder="Repeat your password"
                      className="bg-white border-[#E6E8EC] text-[#0B0F17] placeholder:text-[#8C95A3] focus:border-[#17B6C3] focus:ring-[#17B6C3]/20 h-10 text-sm"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={acceptMutation.isPending}
              className="w-full bg-[#17B6C3] hover:bg-[#139BA6] text-white h-10 text-sm font-medium mt-2"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {acceptMutation.isPending ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </Form>

        <p className="text-xs text-[#8C95A3] text-center mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-[#17B6C3] hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
