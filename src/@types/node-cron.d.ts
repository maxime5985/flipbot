declare module 'node-cron' {
  interface ScheduledTask {
    start(): this;
    stop(): this;
    destroy(): void;
  }
  interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
    runOnInit?: boolean;
    recoverMissedExecutions?: boolean;
    name?: string;
  }
  function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions
  ): ScheduledTask;
  function validate(expression: string): boolean;
}
