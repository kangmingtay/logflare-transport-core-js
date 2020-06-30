import axios, {AxiosInstance, AxiosResponse} from "axios"
import _ from "lodash"
import {
    applyNumberToStringTypecasting,
    applyCustomTypecasting,
} from "./typecasting"
import stream from "stream"

interface LogflareUserOptionsI {
    sourceToken: string
    apiKey: string
    apiBaseUrl?: string
    transforms?: object
    endpoint: string
}

const defaultOptions = {
    apiBaseUrl: "https://api.logflare.app",
}

class LogflareHttpClient {
    protected axiosInstance: AxiosInstance
    protected readonly sourceToken: string
    protected readonly transforms?: object
    protected readonly endpoint?: string

    public constructor(options: LogflareUserOptionsI) {
        const {sourceToken, apiKey, transforms, endpoint} = options
        if (!sourceToken || sourceToken == "") {
            throw "Logflare API logging transport source token is NOT configured!"
        }
        if (!apiKey || apiKey == "") {
            throw "Logflare API logging transport api key is NOT configured!"
        }
        this.transforms = transforms
        this.sourceToken = sourceToken
        this.endpoint = endpoint
        this.axiosInstance = axios.create({
            baseURL: options.apiBaseUrl || defaultOptions.apiBaseUrl,
            headers: {
                "Content-Type": "application/json",
                "X-API-KEY": apiKey,
            },
        })

        this._initializeResponseInterceptor()
    }

    public async addLogEvent(logEvent: object | object[]): Promise<object> {
        let logEvents = Array.isArray(logEvent) ? logEvent : [logEvent]
        if (this?.transforms?.jsNumbers) {
            logEvents = _.map(logEvents, applyNumberToStringTypecasting)
        }
        return this.postLogEvents(logEvents)
    }

    public insertStream() {
        const self = this
        const writeStream = new stream.Writable({
            objectMode: true,
            highWaterMark: 1,
        })
        writeStream._write = function (chunk, encoding, callback) {
            self.addLogEvent(chunk)
                .then(() => {
                    callback(null)
                })
                .catch(callback)
        }
        return writeStream
    }

    private async postLogEvents(batch: object[]) {
        let url
        if (this.endpoint === "typecasting") {
            url = "/logs/typecasts"
        } else {
            url = "/logs"
        }
        const payload = {
            batch,
            source: this.sourceToken,
        }
        try {
            return await this.axiosInstance.post(url, payload)
        } catch (e) {
            console.error(
                `Logflare API request failed with ${
                    e.response.status
                } status: ${JSON.stringify(e.response.data)}`
            )
            return e
        }
    }

    private _initializeResponseInterceptor = () => {
        this.axiosInstance.interceptors.response.use(
            this._handleResponse,
            this._handleError
        )
    }

    private _handleResponse = ({data}: AxiosResponse) => data
    protected _handleError = (error: any) => Promise.reject(error)
}

export {LogflareHttpClient, LogflareUserOptionsI}
