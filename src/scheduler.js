import cron from 'node-cron'
import { config } from './config.js'
import { runLabReportJob } from './job.js'

console.log(`[scheduler] Scheduling lab report job with cron pattern: "${config.cronSchedule}"`)
console.log('[scheduler] (default "0 0 * * *" = once every 24 hours, at midnight)')

cron.schedule(config.cronSchedule, () => {
  runLabReportJob()
})

console.log('[scheduler] Scheduler is running. Leave this process alive. Press Ctrl+C to stop.')
