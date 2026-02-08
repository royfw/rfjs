import { OpenAPI } from 'routing-controllers-openapi';
import { TDataType } from '@/common/types/api.type';

export const ApiResPaginatedSchema = <TModel extends TDataType<any>>(
  model: TModel,
  option?: {
    status?: number;
    description?: string;
    contentType?: string;
  },
) => {
  const properties = {
    type: 'array',
    items: { $ref: `#/components/schemas/${model.name}` },
  };
  const statuscode = option?.status ?? 200;
  const contentType = option?.contentType ?? 'application/json';

  return OpenAPI({
    description: option?.description,
    responses: {
      [`${statuscode}`]: {
        content: {
          [`${contentType}`]: {
            schema: {
              allOf: [
                {
                  $ref: `#/components/schemas/ApiResPaginatedDTO`,
                },
                {
                  properties: {
                    data: properties,
                  },
                },
              ],
            },
          },
        },
      },
    },
  });
};

export const ApiResDataSchema = <TModel extends TDataType<any>>(
  model: TModel,
  options?: {
    isArray?: boolean;
    status?: number;
    description?: string;
    contentType?: string;
  },
) => {
  const isTypedModel = [String.name, Number.name, Boolean.name].includes(model.name);
  let properties = {};
  if (options?.isArray) {
    properties = isTypedModel
      ? {
          type: 'array',
          items: { type: model.name.toLowerCase() },
        }
      : {
          type: 'array',
          items: { $ref: `#/components/schemas/${model.name}` },
        };
  } else {
    properties = isTypedModel
      ? { type: model.name.toLowerCase() }
      : { $ref: `#/components/schemas/${model.name}` };
  }
  const statuscode = options?.status ?? 200;
  const contentType = options?.contentType ?? 'application/json';

  return OpenAPI({
    description: options?.description,
    responses: {
      [`${statuscode}`]: {
        content: {
          [`${contentType}`]: {
            schema: {
              allOf: [
                {
                  $ref: `#/components/schemas/ApiResDataDTO`,
                },
                {
                  properties: {
                    data: properties,
                  },
                },
              ],
            },
          },
        },
      },
    },
  });
};

export const ApiResDataListSchema = <TModel extends TDataType<any>>(
  model: TModel,
  option?: {
    status?: number;
    description?: string;
    contentType?: string;
  },
) => {
  const isTypedModel = [String.name, Number.name, Boolean.name].includes(model.name);
  const properties = {
    type: 'array',
    items: isTypedModel
      ? { type: model.name.toLowerCase() }
      : { $ref: `#/components/schemas/${model.name}` },
  };
  const statuscode = option?.status ?? 200;
  const contentType = option?.contentType ?? 'application/json';

  return OpenAPI({
    description: option?.description,
    responses: {
      [`${statuscode}`]: {
        content: {
          [`${contentType}`]: {
            schema: {
              allOf: [
                {
                  $ref: `#/components/schemas/ApiResDataDTO`,
                },
                {
                  properties: {
                    data: properties,
                  },
                },
              ],
            },
          },
        },
      },
    },
  });
};
