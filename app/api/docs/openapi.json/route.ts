import { NextResponse } from 'next/server'

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Printer Client API',
    version: '1.0.0',
    description: `프린터 클라이언트가 서버에서 인쇄 작업을 가져오고 결과를 보고하는 API입니다.

## 인증
모든 요청에 \`Authorization: Bearer <API_KEY>\` 헤더가 필요합니다.
API Key는 어드민 패널 → 프린터 설정에서 확인할 수 있습니다.

## 워크플로우
1. \`GET /api/printer-client/jobs\` 를 주기적으로 폴링 (3~5초 간격 권장)
2. \`jobs\` 배열에 항목이 있으면 \`imageUrl\`에서 이미지 다운로드
3. 로컬 프린터로 인쇄
4. \`PATCH /api/printer-client/jobs/{jobId}\` 로 결과 보고 (DONE 또는 FAILED)`,
  },
  servers: [{ url: '/' }],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: '프린터 API Key (UUID). 어드민 패널에서 확인 가능.',
      },
    },
    schemas: {
      PrintJob: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: '인쇄 작업 ID', example: '507f1f77bcf86cd799439011' },
          imageUrl: { type: 'string', format: 'uri', description: '인쇄할 이미지 URL (절대 경로, 보정 적용됨)', example: 'https://example.com/api/serve-image/corrected-123456.jpg' },
          createdAt: { type: 'string', format: 'date-time', description: '작업 생성 시간', example: '2026-03-02T10:30:00.000Z' },
        },
      },
      JobStatusUpdate: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['DONE', 'FAILED'], description: '인쇄 결과' },
          errorMessage: { type: 'string', description: '실패 시 에러 메시지', example: 'Paper jam' },
        },
      },
    },
  },
  paths: {
    '/api/printer-client/jobs': {
      get: {
        summary: '대기 중인 인쇄 작업 조회',
        description: '이 프린터에 할당된 PENDING 상태의 인쇄 작업 목록을 반환합니다. 3~5초 간격으로 폴링하세요.',
        tags: ['Print Jobs'],
        responses: {
          '200': {
            description: '대기 중인 작업 목록',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jobs: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PrintJob' },
                    },
                  },
                },
                example: {
                  jobs: [
                    {
                      jobId: '507f1f77bcf86cd799439011',
                      imageUrl: 'https://example.com/api/serve-image/corrected-123456.jpg',
                      createdAt: '2026-03-02T10:30:00.000Z',
                    },
                  ],
                },
              },
            },
          },
          '401': { description: 'API Key가 없거나 유효하지 않음' },
        },
      },
    },
    '/api/printer-client/jobs/{jobId}': {
      patch: {
        summary: '인쇄 결과 보고',
        description: '인쇄 완료 후 결과를 보고합니다. PENDING 상태인 작업만 업데이트 가능합니다.',
        tags: ['Print Jobs'],
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: '인쇄 작업 ID',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JobStatusUpdate' },
              examples: {
                success: {
                  summary: '인쇄 성공',
                  value: { status: 'DONE' },
                },
                failure: {
                  summary: '인쇄 실패',
                  value: { status: 'FAILED', errorMessage: 'Paper jam' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: '상태 업데이트 성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    jobId: { type: 'string' },
                    status: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'status 값이 DONE 또는 FAILED가 아님' },
          '401': { description: 'API Key가 없거나 유효하지 않음' },
          '403': { description: '이 프린터의 작업이 아님' },
          '404': { description: '작업을 찾을 수 없음' },
          '409': { description: '이미 처리된 작업 (PENDING 상태가 아님)' },
        },
      },
    },
  },
}

export async function GET() {
  return NextResponse.json(spec)
}
