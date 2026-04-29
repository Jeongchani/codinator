import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeImageBlurDto {
  @ApiProperty({ example: 1 })
  facesDetected!: number;

  @ApiProperty({ example: true })
  blurred!: boolean;
}

export class AnalyzeImageInfoDto {
  @ApiProperty({ example: 1080 })
  width!: number;

  @ApiProperty({ example: 1440 })
  height!: number;
}

export class AnalyzeImageGarmentDto {
  @ApiProperty({ example: 'TOP' })
  category!: string;

  @ApiProperty({ example: 'TOP' })
  normalizedCategory!: string;

  @ApiProperty({ example: 'top' })
  parserLabel!: string;

  @ApiProperty({ example: 'beige' })
  dominantColor!: string;

  @ApiProperty({ example: 0.2143 })
  areaRatio!: number;

  @ApiProperty({ example: 0.6 })
  confidence!: number;

  @ApiProperty({ example: [120, 180, 650, 760], type: [Number] })
  bbox!: number[];

  @ApiProperty({ example: ['black'], type: [String] })
  colorTags!: string[];

  @ApiProperty({ example: ['regular'], type: [String] })
  fitTags!: string[];

  @ApiProperty({ example: ['long'], type: [String] })
  lengthTags!: string[];

  @ApiProperty({ example: ['cotton'], type: [String] })
  materialTags!: string[];

  @ApiProperty({ example: ['daily', 'minimal'], type: [String] })
  styleTags!: string[];

  @ApiProperty({ example: ['fall', 'winter'], type: [String] })
  seasonTags!: string[];

  @ApiProperty({ example: ['daily'], type: [String] })
  occasionTags!: string[];
}

export class AnalyzeImageEmbeddingDto {
  @ApiProperty({ example: 'fashion-clip' })
  modelName!: string;

  @ApiProperty({ example: 'patrickjohncyh/fashion-clip' })
  modelVersion!: string;

  @ApiProperty({ example: 512 })
  dimension!: number;

  @ApiProperty({ example: [0.0123, -0.0456, 0.0789], type: [Number] })
  vector!: number[];
}

export class AnalyzeImageGarmentEmbeddingDto extends AnalyzeImageEmbeddingDto {
  @ApiProperty({ example: 'TOP' })
  category!: string;
}

export class AnalyzeImageAnalysisDto {
  @ApiProperty({ example: 'black 상의와 blue 하의를 매치한 데일리룩' })
  caption!: string;

  @ApiProperty({ example: ['daily', 'minimal', 'fall'], type: [String] })
  summaryTags!: string[];

  @ApiProperty({ type: [AnalyzeImageGarmentDto] })
  garments!: AnalyzeImageGarmentDto[];
}

export class AnalyzeImageEmbeddingsDto {
  @ApiProperty({ type: AnalyzeImageEmbeddingDto })
  outfit!: AnalyzeImageEmbeddingDto;

  @ApiProperty({ type: [AnalyzeImageGarmentEmbeddingDto] })
  garments!: AnalyzeImageGarmentEmbeddingDto[];
}

export class AnalyzeImageMetaDto {
  @ApiProperty({ example: false })
  scaffold!: boolean;

  @ApiProperty({ example: 'fashn-human-parser' })
  parserModelName!: string;

  @ApiProperty({ example: 'fashn-ai/fashn-human-parser' })
  parserModelVersion!: string;

  @ApiProperty({ example: 'fashion-clip' })
  embedModelName!: string;

  @ApiProperty({ example: 'patrickjohncyh/fashion-clip' })
  embedModelVersion!: string;

  @ApiProperty({ example: 'florence-2-base' })
  captionModelName!: string;

  @ApiProperty({ example: 'failed' })
  captionModelVersion!: string;

  @ApiProperty({ example: true })
  captionFallbackUsed!: boolean;

  @ApiProperty({ example: ['caption_failed'], type: [String] })
  warnings!: string[];

  @ApiProperty({ example: 47 })
  processingMs!: number;
}

export class AnalyzeImageResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'ai-real-models-v2.3' })
  pipelineVersion!: string;

  @ApiProperty({ type: AnalyzeImageMetaDto })
  meta!: AnalyzeImageMetaDto;

  @ApiProperty({ type: AnalyzeImageInfoDto })
  image!: AnalyzeImageInfoDto;

  @ApiProperty({ type: AnalyzeImageBlurDto })
  blur!: AnalyzeImageBlurDto;

  @ApiProperty({ type: AnalyzeImageAnalysisDto })
  analysis!: AnalyzeImageAnalysisDto;

  @ApiProperty({ type: AnalyzeImageEmbeddingsDto })
  embeddings!: AnalyzeImageEmbeddingsDto;
}
