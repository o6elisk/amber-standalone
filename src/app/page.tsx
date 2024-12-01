"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { type Database } from "@/types/supabase";
import { type ToastProps } from "@radix-ui/react-toast";
import { useState, useEffect } from 'react';

const supabase = createClient(
  'https://qqyaebpieshwhigyzaou.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxeWFlYnBpZXNod2hpZ3l6YW91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjAwNDY2MCwiZXhwIjoyMDQ3NTgwNjYwfQ.zWtCv2SQKwuBIRREXBdHgHY1URTaBpQoCfXwT2WX76k'
);

const formSchema = z.object({
  high_price_threshold: z.coerce.number(),
  low_price_threshold: z.coerce.number(),
  renewable_threshold: z.coerce.number(),
  notification_email: z.string().email(),
  user_first_name: z.string().min(1),
  amber_api_token: z.string().min(1),
  amber_site_id: z.string().optional(),
  notifications_enabled: z.boolean(),
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z.string(),
  quiet_hours_end: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      high_price_threshold: 0,
      low_price_threshold: 0,
      renewable_threshold: 0,
      notification_email: "",
      user_first_name: "",
      amber_api_token: "",
      amber_site_id: "",
      notifications_enabled: true,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
    },
  });

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const loadUserData = async () => {
      const savedEmail = localStorage.getItem('userEmail');
      if (savedEmail) {
        try {
          const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('notification_email', savedEmail)
            .single();
          
          if (error) {
            console.error('Error loading user data:', error);
            return;
          }

          if (data) {
            form.reset(data);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      }
    };

    loadUserData();
  }, []);

  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    try {
      // First, try to fetch the site ID using the API token
      const sitesResponse = await fetch('https://api.amber.com.au/v1/sites', {
        headers: {
          'Authorization': `Bearer ${values.amber_api_token}`,
          'Accept': 'application/json'
        }
      });

      if (!sitesResponse.ok) {
        throw new Error('Failed to fetch sites. Please check your API token.');
      }

      const sites = await sitesResponse.json();
      
      if (!sites || sites.length === 0) {
        throw new Error('No sites found for this API token.');
      }

      // Use the first site's ID
      const siteId = sites[0].id;

      // Update the form immediately with the new site ID
      form.setValue('amber_site_id', siteId);

      // Update the form values with the site ID
      const updatedValues = {
        ...values,
        amber_site_id: siteId
      };

      // Now save to Supabase with the site ID
      const { error } = await supabase
        .from('settings')
        .upsert([{
          ...updatedValues,
          updated_at: new Date().toISOString(),
        }], {
          onConflict: 'notification_email',
          ignoreDuplicates: false
        });

      if (error) throw error;

      // Save email to localStorage after successful submission
      localStorage.setItem('userEmail', values.notification_email);

      toast({
        title: "✅ Settings Saved",
        description: "Your preferences have been updated successfully.",
        className: "bg-green-50 border-green-200",
      } as ToastProps);
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings. Please try again.",
        variant: "destructive",
      } as ToastProps);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="max-w-md mx-auto bg-white border border-border rounded-xl shadow-md overflow-hidden p-6">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="user_first_name"
              render={({ field }) => (
                <FormItem>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <FormLabel>First Name</FormLabel>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Your first name for personalized notifications</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notification_email"
              render={({ field }) => (
                <FormItem>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <FormLabel>Email</FormLabel>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Where you'll receive notifications</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <FormControl>
                    <Input placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amber_api_token"
              render={({ field }) => (
                <FormItem>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <FormLabel>Amber API Token</FormLabel>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Your Amber API token from the developers page</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <FormControl>
                    <Input placeholder="Enter your Amber API token" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amber_site_id"
              render={({ field }) => (
                <FormItem>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <FormLabel>Amber Site ID</FormLabel>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Your Amber site ID - automatically fetched when you save settings</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <FormControl>
                    <Input 
                      disabled
                      placeholder="Save settings to generate" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="high_price_threshold"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <FormLabel>High Price Threshold (¢/kWh)</FormLabel>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Get notified when price exceeds this value</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="text-sm text-muted-foreground">
                      {field.value} ¢/kWh
                    </div>
                  </div>
                  <FormControl>
                    <div className="space-y-1">
                      <Slider
                        min={0}
                        max={200}
                        step={1}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="low_price_threshold"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <FormLabel>Low Price Threshold (¢/kWh)</FormLabel>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Get notified when price falls below this value</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="text-sm text-muted-foreground">
                      {field.value} ¢/kWh
                    </div>
                  </div>
                  <FormControl>
                    <div className="space-y-1">
                      <Slider
                        min={0}
                        max={200}
                        step={1}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="renewable_threshold"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <FormLabel>Renewable Threshold (%)</FormLabel>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Get notified when renewable percentage exceeds this value</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="text-sm text-muted-foreground">
                      {field.value}%
                    </div>
                  </div>
                  <FormControl>
                    <div className="space-y-1">
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notifications_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <FormLabel className="text-base">Notifications</FormLabel>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Enable or disable all notifications</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <FormDescription>
                      Enable or disable notifications
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quiet_hours_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <FormLabel className="text-base">Quiet Hours</FormLabel>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>No notifications during quiet hours</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <FormDescription>
                      Enable or disable quiet hours
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("quiet_hours_enabled") && (
              <div className="flex gap-4">
                <FormField
                  control={form.control}
                  name="quiet_hours_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quiet_hours_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="mr-2">Saving...</span>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
