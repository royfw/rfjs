import { ApiResDataDTO, ApiResErrorDTO, ApiResPaginatedDTO } from '@/common/dto';
import { Body, Get, HeaderParam, JsonController, Post } from 'routing-controllers';
import {
  ApiResDataListSchema,
  ApiResDataSchema,
  ApiResPaginatedSchema,
} from '@/common/decorators/api.decorator';
import { AppDataDTO, AppInfoDTO, AppPostBodyDTO } from '@/modules/app/dto';
import { AppData, AppInfo } from '@/modules/app/types';
import { AppUseCase } from '@/modules/app/app.usecase';
import { ResponseSchema } from 'routing-controllers-openapi';
import { inject, injectable } from 'tsyringe';
import httpStatus from 'http-status';

@injectable()
@ResponseSchema(ApiResErrorDTO, {
  statusCode: httpStatus.BAD_REQUEST,
})
@JsonController('/app')
export class AppController {
  constructor(
    @inject(AppUseCase)
    private readonly appUseCase: AppUseCase, // Replace 'any' with the actual type of your service
  ) {}
  // This is a placeholder for the AppController.
  // You can add methods here to handle requests.
  // For example, you can create a method to return a welcome message.

  @Get()
  @ResponseSchema(AppInfoDTO)
  getApp(): AppInfo {
    const data = this.appUseCase.getApp();
    return data;
  }

  @Get('/data')
  @ApiResDataSchema(AppDataDTO)
  getAppData(): ApiResDataDTO<AppData> {
    const data = this.appUseCase.getAppData();
    const result = new ApiResDataDTO<AppData>({
      success: true,
      status: 200,
      data,
    });
    return result;
  }

  @Get('/data-list')
  @ApiResDataListSchema(AppDataDTO)
  getAppDataList(): ApiResDataDTO<AppData[]> {
    const data = this.appUseCase.getAppData();
    const result = new ApiResDataDTO<AppData[]>({
      success: true,
      status: 200,
      data: [data],
    });
    return result;
  }

  @Get('/data-pagination')
  @ApiResPaginatedSchema(AppDataDTO)
  getAppDataPaginated(): ApiResPaginatedDTO<AppData> {
    const data = this.appUseCase.getAppData();
    const result = new ApiResPaginatedDTO<AppData>({
      success: true,
      status: 200,
      total: 1,
      data: [data],
    });
    return result;
  }

  @Post('/data')
  @ApiResDataSchema(AppPostBodyDTO)
  postAppData(@Body() body: AppPostBodyDTO) {
    const result = new ApiResDataDTO<AppPostBodyDTO>({
      success: true,
      status: 200,
      data: body,
    });
    return result;
  }

  @Get('/header-params')
  @ApiResDataSchema(String)
  getHeaderParams(@HeaderParam('header-test') headerTest: string) {
    const result = new ApiResDataDTO<string>({
      success: true,
      status: 200,
      data: headerTest,
    });
    return result;
  }

  @Get('/error')
  getError() {
    throw new Error('This is a test error from the App Controller.');
  }
}
