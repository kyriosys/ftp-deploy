import prettyMilliseconds from "pretty-ms";
import { ErrorCode } from "./types";

export interface ILogger {
    all(...data: any[]): void;
    standard(...data: any[]): void;
    verbose(...data: any[]): void;
}

export class Logger implements ILogger {
    constructor(level: "minimal" | "standard" | "verbose") {
        this.level = level;
    }

    private level: "minimal" | "standard" | "verbose";

    public all(...data: any[]): void {
        console.log(...data);
    }

    public standard(...data: any[]): void {
        if (this.level === "minimal") { return; }

        console.log(...data);
    }

    public verbose(...data: any[]): void {
        if (this.level !== "verbose") { return; }

        console.log(...data);
    }
}

export function pluralize(count: number, singular: string, plural: string) {
    if (count === 1) {
        return singular;
    }

    return plural;
}

/**
 * retry a request
 * 
 * @example retryRequest(logger, async () => await item());
 */
export async function retryRequest<T>(logger: ILogger, callback: () => Promise<T>): Promise<T> {
    try {
        return await callback();
    }
    catch (e) {
        if (e.code >= 400 && e.code <= 499) {
            logger.standard("400 level error from server when performing action - retrying...");
            logger.standard(e);

            if (e.code === ErrorCode.ConnectionClosed) {
                logger.all("Connection closed. This library does not currently handle reconnects");
                // await global.reconnect();
                // todo reset current working dir
                throw e;
            }

            return await callback();
        }
        else {
            throw e;
        }
    }
}

interface ITimers {
    [key: string]: Timer | undefined;
}

type AvailableTimers = "connecting" | "hash" | "upload" | "total" | "changingDir" | "logging";

export class Timings {
    private timers: ITimers = {};

    public start(type: AvailableTimers): void {
        if (this.timers[type] === undefined) {
            this.timers[type] = new Timer();
        }

        this.timers[type]!.start();
    }

    public stop(type: AvailableTimers): void {
        this.timers[type]!.stop();
    }

    public getTime(type: AvailableTimers): number {
        const timer = this.timers[type];
        if (timer === undefined || timer.time === null) {
            return 0;
        }

        return timer.time;
    }

    public getTimeFormatted(type: AvailableTimers): string {
        const timer = this.timers[type];
        if (timer === undefined || timer.time === null) {
            return "💣 Failed";
        }

        return prettyMilliseconds(timer.time, { verbose: true });
    }
}

/**
 * first number is seconds
 * second number is nanoseconds
 */
type HRTime = [number, number];

export class Timer {
    private totalTime: HRTime | null = null;
    private startTime: HRTime | null = null;
    private endTime: HRTime | null = null;

    start() {
        this.startTime = process.hrtime();
    }

    stop() {
        if (this.startTime === null) {
            throw new Error("Called .stop() before calling .start()");
        }

        this.endTime = process.hrtime(this.startTime);

        const currentSeconds = this.totalTime === null ? 0 : this.totalTime[0];
        const currentNS = this.totalTime === null ? 0 : this.totalTime[1];

        this.totalTime = [
            currentSeconds + this.endTime[0],
            currentNS + this.endTime[1]
        ];
    }

    get time() {
        if (this.totalTime === null) {
            return null;
        }

        return (this.totalTime[0] * 1000) + (this.totalTime[1] / 1000000);
    }
}