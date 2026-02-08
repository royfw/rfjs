import { JsonController, Post, UploadedFiles } from 'routing-controllers';
import { UploadFileDTO, UploadFileInfoDTO } from '@/common/dto/file.dto';
import { ApiResDataListSchema } from '@/common/decorators';
import { ApiResData } from '@/common/types';
import { ApiResDataDTO } from '@/common/dto';
import { fileUploadOptions } from '@/helpers';
import { plainToInstance } from 'class-transformer';

@JsonController('/files')
export class FileController {
  private static instance: FileController;

  private constructor() {
    // Private constructor to prevent instantiation
  }

  public static getInstance(): FileController {
    if (!FileController.instance) {
      FileController.instance = new FileController();
    }
    return FileController.instance;
  }

  @Post('/upload')
  @ApiResDataListSchema(UploadFileInfoDTO)
  public uploadFile(
    @UploadedFiles('files', { options: fileUploadOptions() }) files: UploadFileDTO[],
  ): ApiResData<UploadFileInfoDTO[]> {
    files = plainToInstance(UploadFileDTO, files);
    const data: UploadFileInfoDTO[] = files.map((file) => ({
      fieldname: file.fieldname,
      originalname: file.originalname,
      encoding: file.encoding,
      mimetype: file.mimetype,
      size: file.size,
      destination: file.destination,
      filename: file.filename,
      path: file.path,
    }));
    const result = new ApiResDataDTO<UploadFileInfoDTO[]>({
      success: true,
      status: 200,
      data,
    });
    return result;
  }
}
