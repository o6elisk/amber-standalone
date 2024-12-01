import { logger, schedules } from "@trigger.dev/sdk/v3";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LoopsClient } from "loops";

// Define types
interface UserSettings {
  notification_email: string;
  user_first_name: string;
  amber_api_token: string;
  amber_site_id: string;
  high_price_threshold: number;
  low_price_threshold: number;
  renewable_threshold: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  active: boolean;
  notifications_enabled: boolean;
}

interface AmberPrice {
  type: string;
  duration: number;
  spotPerKwh: number;
  perKwh: number;
  renewables: number;
  channelType: string;
  spikeStatus: string;
}

// Initialize Loops client
const loops = new LoopsClient(process.env.LOOPS_API_KEY!);

// Helper function to check if we're in quiet hours
function isInQuietHours(start: string, end: string): boolean {
  const now = new Date();
  const currentTime = now.getHours() * 100 + now.getMinutes();
  const startTime = parseInt(start.replace(':', ''));
  const endTime = parseInt(end.replace(':', ''));
  
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }
  return currentTime >= startTime && currentTime < endTime;
}

// Helper function to fetch current price and renewables
async function fetchAmberData(apiToken: string, siteId: string): Promise<{ price: number; renewables: number }> {
  const response = await fetch(`https://api.amber.com.au/v1/sites/${siteId}/prices/current`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Amber data: ${response.statusText}`);
  }

  const data = await response.json();
  const generalChannel = data.find((price: AmberPrice) => price.channelType === 'general');

  if (!generalChannel) {
    throw new Error('No general channel price found');
  }

  return {
    price: generalChannel.perKwh,
    renewables: generalChannel.renewables
  };
}

// Helper function to send email notification
async function sendNotification(user: UserSettings, alertType: 'high_price' | 'low_price' | 'renewable', currentValue: number, threshold: number): Promise<void> {
  try {
    let alertDescriptor: string;
    let thresholdDescriptor: string;
    let alertMessage: string;

    switch (alertType) {
      case 'high_price':
        alertDescriptor = "High Price Alert ⚡";
        thresholdDescriptor = "above";
        alertMessage = `The current price (${currentValue.toFixed(2)}¢/kWh) is above your threshold of ${threshold.toFixed(2)}¢/kWh. You may want to reduce your energy usage.`;
        break;
      case 'low_price':
        alertDescriptor = "Low Price Alert 💰";
        thresholdDescriptor = "below";
        alertMessage = `The current price (${currentValue.toFixed(2)}¢/kWh) is below your threshold of ${threshold.toFixed(2)}¢/kWh. This might be a good time to use energy-intensive appliances.`;
        break;
      case 'renewable':
        alertDescriptor = "High Renewables Alert 🌱";
        thresholdDescriptor = "above";
        alertMessage = `The current renewable percentage (${currentValue.toFixed(0)}%) is above your threshold of ${threshold}%. This is a great time to use electricity!`;
        break;
    }

    await loops.sendTransactionalEmail({
      transactionalId: "cm3tz7b1m00pp4fxob8yjbbb9",
      email: user.notification_email,
      dataVariables: {
        first_name: user.user_first_name,
        alert_descriptor: alertDescriptor,
        current_price: currentValue.toFixed(2),
        threshold_descriptor: thresholdDescriptor,
        alert_message: alertMessage
      }
    });
    logger.info(`${alertDescriptor} notification sent to ${user.notification_email}`);
  } catch (error) {
    logger.error(`Failed to send notification to ${user.notification_email}`, { error });
  }
}

// Main trigger task
export const standalonePriceMonitor = schedules.task({
  id: "standalone-price-monitor",
  cron: { 
    pattern: "*/30 * * * *",
    timezone: "Australia/Sydney"
  },
  run: async (task) => {
    try {
      // Initialize Supabase client inside the task
      const supabase: SupabaseClient = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY! // Using service key for background tasks
      );

      // Fetch all active users with notifications enabled
      const { data: users, error } = await supabase
        .from('settings')
        .select('*')
        .eq('active', true)
        .eq('notifications_enabled', true);

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      if (!users) {
        logger.info("No active users found");
        return;
      }

      // Process each user
      for (const user of users as UserSettings[]) {
        try {
          // Skip if in quiet hours
          if (user.quiet_hours_enabled && isInQuietHours(user.quiet_hours_start, user.quiet_hours_end)) {
            logger.info(`Skipping notifications for ${user.notification_email} - quiet hours`);
            continue;
          }

          // Skip if missing API token or site ID
          if (!user.amber_api_token || !user.amber_site_id) {
            logger.warn(`Missing API token or site ID for ${user.notification_email}`);
            continue;
          }

          // Fetch current price and renewables data
          const data = await fetchAmberData(user.amber_api_token, user.amber_site_id);

          // Check thresholds and send notifications
          if (data.price > user.high_price_threshold) {
            await sendNotification(
              user,
              'high_price',
              data.price,
              user.high_price_threshold
            );
          }

          if (data.price < user.low_price_threshold) {
            await sendNotification(
              user,
              'low_price',
              data.price,
              user.low_price_threshold
            );
          }

          if (data.renewables > user.renewable_threshold) {
            await sendNotification(
              user,
              'renewable',
              data.renewables,
              user.renewable_threshold
            );
          }

        } catch (error) {
          logger.error(`Error processing user ${user.notification_email}`, { error });
          continue; // Continue with next user even if one fails
        }
      }

      logger.info("Price monitor check completed successfully");
    } catch (error) {
      logger.error("Price monitor failed", { error });
      throw error;
    }
  },
});