import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import FormData = require('form-data');

export interface BinaryImageInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface FaceBlurResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  facesDetected: number;
  blurred: boolean;
  width: number;
  height: number;
}

export interface AnalyzeImageGarment {
  category: string;
  normalizedCategory: string;
  parserLabel: string | null;
  dominantColor: string | null;
  areaRatio: number | null;
  confidence: number;
  bbox: number[];
  colorTags: string[];
  fitTags: string[];
  lengthTags: string[];
  materialTags: string[];
  styleTags: string[];
  seasonTags: string[];
  occasionTags: string[];
}

export interface AnalyzeImageEmbedding {
  modelName: string;
  modelVersion: string;
  dimension: number;
  vector: number[];
}

export interface AnalyzeImageGarmentEmbedding extends AnalyzeImageEmbedding {
  category: string;
}

export interface AnalyzeImageResult {
  success: true;
  pipelineVersion: string;
  meta: {
    scaffold: boolean;
    parserModelName: string;
    parserModelVersion: string;
    embedModelName: string;
    embedModelVersion: string;
    captionModelName: string;
    captionModelVersion: string;
    captionFallbackUsed: boolean;
    warnings: string[];
    processingMs: number;
  };
  image: {
    width: number;
    height: number;
  };
  blur: {
    facesDetected: number;
    blurred: boolean;
  };
  analysis: {
    caption: string;
    summaryTags: string[];
    garments: AnalyzeImageGarment[];
  };
  embeddings: {
    outfit: AnalyzeImageEmbedding;
    garments: AnalyzeImageGarmentEmbedding[];
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private readonly aiServerBaseUrl =
    process.env.AI_SERVER_BASE_URL || 'http://127.0.0.1:8000/api/v3';

  private readonly aiTimeoutMs = Number(process.env.AI_SERVER_TIMEOUT_MS || 60000);

  async blurFace(image: Express.Multer.File): Promise<FaceBlurResult> {
    return this.blurFaceBinary({
      buffer: image.buffer,
      filename: image.originalname,
      mimeType: image.mimetype,
    });
  }

  async blurFaceBinary(input: BinaryImageInput): Promise<FaceBlurResult> {
    const formData = new FormData();

    formData.append('image', input.buffer, {
      filename: input.filename,
      contentType: input.mimeType,
      knownLength: input.buffer.length,
    });

    try {
      const response = await axios.post<ArrayBuffer>(
        `${this.aiServerBaseUrl}/blur-face`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: this.aiTimeoutMs,
          maxBodyLength: Infinity,
          responseType: 'arraybuffer',
        },
      );

      const mimeType = this.readHeader(response.headers['content-type'], input.mimeType);
      const extension = this.getExtensionFromMimeType(mimeType, input.filename);

      return {
        buffer: Buffer.from(response.data),
        mimeType,
        extension,
        facesDetected: Number(response.headers['x-ai-faces-detected'] ?? 0),
        blurred: String(response.headers['x-ai-blurred'] ?? 'false') === 'true',
        width: Number(response.headers['x-ai-width'] ?? 0),
        height: Number(response.headers['x-ai-height'] ?? 0),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new GatewayTimeoutException({
            success: false,
            error: {
              code: 'AI_SERVER_TIMEOUT',
              message: 'AI 서버 응답 시간이 초과되었습니다.',
              details: {
                timeoutMs: this.aiTimeoutMs,
              },
            },
          });
        }

        this.logger.error(
          `AI server request failed: status=${error.response?.status}, data=${this.stringifyAxiosErrorData(error.response?.data)}`,
        );

        throw new BadGatewayException({
          success: false,
          error: {
            code: 'AI_SERVER_REQUEST_FAILED',
            message: 'AI 서버 호출에 실패했습니다.',
            details: {
              status: error.response?.status,
            },
          },
        });
      }

      this.logger.error(`Unknown AI server error: ${String(error)}`);

      throw new BadGatewayException({
        success: false,
        error: {
          code: 'AI_SERVER_REQUEST_FAILED',
          message: 'AI 서버 호출에 실패했습니다.',
        },
      });
    }
  }

  async analyzeImage(image: Express.Multer.File): Promise<AnalyzeImageResult> {
    return this.analyzeImageBinary({
      buffer: image.buffer,
      filename: image.originalname,
      mimeType: image.mimetype,
    });
  }

  async analyzeImageBinary(input: BinaryImageInput): Promise<AnalyzeImageResult> {
    const formData = new FormData();

    formData.append('image', input.buffer, {
      filename: input.filename,
      contentType: input.mimeType,
      knownLength: input.buffer.length,
    });

    try {
      const response = await axios.post<AnalyzeImageResult>(
        `${this.aiServerBaseUrl}/analyze-image`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: this.aiTimeoutMs,
          maxBodyLength: Infinity,
          responseType: 'json',
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new GatewayTimeoutException({
            success: false,
            error: {
              code: 'AI_SERVER_TIMEOUT',
              message: 'AI 이미지 분석 응답 시간이 초과되었습니다.',
              details: {
                timeoutMs: this.aiTimeoutMs,
              },
            },
          });
        }

        this.logger.error(
          `AI image analysis request failed: status=${error.response?.status}, data=${this.stringifyAxiosErrorData(error.response?.data)}`,
        );

        throw new BadGatewayException({
          success: false,
          error: {
            code: 'AI_IMAGE_ANALYSIS_FAILED',
            message: 'AI 이미지 분석 호출에 실패했습니다.',
            details: {
              status: error.response?.status,
            },
          },
        });
      }

      this.logger.error(`Unknown AI image analysis error: ${String(error)}`);

      throw new BadGatewayException({
        success: false,
        error: {
          code: 'AI_IMAGE_ANALYSIS_FAILED',
          message: 'AI 이미지 분석 호출에 실패했습니다.',
        },
      });
    }
  }

  private readHeader(value: string | string[] | undefined, fallback: string): string {
    if (Array.isArray(value)) {
      return value[0] ?? fallback;
    }

    return value ?? fallback;
  }

  private getExtensionFromMimeType(mimeType: string, originalFilename: string): string {
    if (mimeType === 'image/jpeg') {
      return 'jpg';
    }

    if (mimeType === 'image/png') {
      return 'png';
    }

    if (mimeType === 'image/webp') {
      return 'webp';
    }

    const originalParts = originalFilename.split('.');
    const originalExt = originalParts.length > 1 ? originalParts.pop() : 'jpg';
    return (originalExt || 'jpg').toLowerCase();
  }

  private stringifyAxiosErrorData(data: unknown): string {
    if (!data) {
      return 'null';
    }

    if (Buffer.isBuffer(data)) {
      return data.toString('utf-8');
    }

    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }
}
