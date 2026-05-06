import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PUBL_EVENT_CATALOG, PublEventPropSeed, PublEventSeed } from './publ-events.catalog';
import { UpsertV2PublEventDto, V2PublEventPropDto } from './v2-publ-events.dto';

const PUBL_PARSER_STEP_TYPES = new Set([
  'none',
  'fallback',
  'join',
  'mapTemplate',
  'firstItem',
  'dateFormat',
  'currencyFormat',
  'phoneFormat',
  'truncate',
  'replace'
]);

@Injectable()
export class V2PublEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    await this.ensureDefaultCatalog();

    const items = await this.prisma.publEventDefinition.findMany({
      include: {
        props: {
          orderBy: [{ sortOrder: 'asc' }, { rawPath: 'asc' }]
        }
      },
      orderBy: [
        { serviceStatus: 'asc' },
        { category: 'asc' },
        { displayName: 'asc' }
      ]
    });

    const activeCount = items.filter((item) => item.serviceStatus === 'ACTIVE').length;
    const inactiveCount = items.filter((item) => item.serviceStatus === 'INACTIVE').length;
    const draftCount = items.filter((item) => item.serviceStatus === 'DRAFT').length;

    return {
      counts: {
        totalCount: items.length,
        activeCount,
        inactiveCount,
        draftCount
      },
      categories: Array.from(new Set(items.map((item) => item.category))).sort(),
      parserOptions: [
        'none',
        'fallback',
        'join',
        'mapTemplate',
        'firstItem',
        'dateFormat',
        'currencyFormat',
        'phoneFormat',
        'truncate',
        'replace'
      ],
      items: items.map((item) => this.serializeEvent(item))
    };
  }

  async create(dto: UpsertV2PublEventDto) {
    await this.ensureEventKeyAvailable(dto.eventKey);

    const normalized = this.normalizeEventInput(dto);
    const created = await this.prisma.publEventDefinition.create({
      data: {
        ...normalized.event,
        props: {
          createMany: {
            data: normalized.props
          }
        }
      },
      include: {
        props: {
          orderBy: [{ sortOrder: 'asc' }, { rawPath: 'asc' }]
        }
      }
    });

    return {
      item: this.serializeEvent(created)
    };
  }

  async update(eventId: string, dto: UpsertV2PublEventDto) {
    const existing = await this.prisma.publEventDefinition.findUnique({
      where: { id: eventId },
      select: { id: true, eventKey: true }
    });

    if (!existing) {
      throw new NotFoundException('Publ event not found');
    }

    await this.ensureEventKeyAvailable(dto.eventKey, eventId);

    const normalized = this.normalizeEventInput(dto);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.publEventPropDefinition.deleteMany({
        where: { eventId }
      });

      return tx.publEventDefinition.update({
        where: { id: eventId },
        data: {
          ...normalized.event,
          props: {
            createMany: {
              data: normalized.props
            }
          }
        },
        include: {
          props: {
            orderBy: [{ sortOrder: 'asc' }, { rawPath: 'asc' }]
          }
        }
      });
    });

    return {
      item: this.serializeEvent(updated)
    };
  }

  private async ensureDefaultCatalog() {
    for (const seed of PUBL_EVENT_CATALOG) {
      const existing = await this.prisma.publEventDefinition.findFirst({
        where: {
          OR: [
            { catalogKey: seed.catalogKey },
            { eventKey: seed.eventKey }
          ]
        },
        include: {
          props: {
            select: { rawPath: true }
          }
        }
      });

      if (!existing) {
        await this.prisma.publEventDefinition.create({
          data: {
            catalogKey: seed.catalogKey,
            eventKey: seed.eventKey,
            displayName: seed.displayName,
            category: seed.category,
            pAppCode: seed.pAppCode ?? null,
            pAppName: seed.pAppName ?? null,
            triggerText: seed.triggerText ?? null,
            detailText: seed.detailText ?? null,
            serviceStatus: seed.serviceStatus,
            locationType: seed.locationType ?? null,
            locationId: seed.locationId ?? null,
            sourceType: seed.sourceType ?? null,
            actionType: seed.actionType ?? null,
            docsVersion: seed.docsVersion,
            editable: true,
            props: {
              createMany: {
                data: this.normalizeSeedProps(seed.props)
              }
            }
          }
        });
        continue;
      }

      if (!existing.catalogKey) {
        await this.prisma.publEventDefinition.update({
          where: { id: existing.id },
          data: {
            catalogKey: seed.catalogKey,
            docsVersion: existing.docsVersion ?? seed.docsVersion
          }
        });
      }

      const existingRawPaths = new Set(existing.props.map((prop) => prop.rawPath));
      const missingProps = seed.props.filter((prop) => !existingRawPaths.has(prop.rawPath));

      if (missingProps.length > 0) {
        await this.prisma.publEventPropDefinition.createMany({
          data: this.normalizeSeedProps(missingProps).map((prop) => ({
            ...prop,
            eventId: existing.id
          }))
        });
      }
    }
  }

  private normalizeSeedProps(props: PublEventPropSeed[]) {
    return this.dedupeProps(props).map((prop, index) => ({
      rawPath: prop.rawPath.trim(),
      alias: prop.alias.trim(),
      label: prop.label.trim(),
      type: prop.type.trim(),
      required: Boolean(prop.required),
      sample: this.nullableText(prop.sample),
      description: this.nullableText(prop.description),
      fallback: this.nullableText(prop.fallback),
      parserPipeline: this.normalizeParserPipeline(prop.parserPipeline),
      enabled: prop.enabled !== false,
      sortOrder: index
    }));
  }

  private normalizeEventInput(dto: UpsertV2PublEventDto) {
    const eventKey = dto.eventKey.trim();
    const displayName = dto.displayName.trim();
    const category = dto.category.trim();

    if (!eventKey || !displayName || !category) {
      throw new ConflictException('eventKey, displayName, category는 비어 있을 수 없습니다.');
    }

    return {
      event: {
        eventKey,
        displayName,
        category,
        pAppCode: this.nullableText(dto.pAppCode),
        pAppName: this.nullableText(dto.pAppName),
        triggerText: this.nullableText(dto.triggerText),
        detailText: this.nullableText(dto.detailText),
        serviceStatus: dto.serviceStatus,
        locationType: this.nullableText(dto.locationType),
        locationId: this.nullableText(dto.locationId),
        sourceType: this.nullableText(dto.sourceType),
        actionType: this.nullableText(dto.actionType),
        docsVersion: this.nullableText(dto.docsVersion)
      },
      props: this.normalizeDtoProps(dto.props ?? [])
    };
  }

  private normalizeDtoProps(props: V2PublEventPropDto[]) {
    return this.dedupeProps(props).map((prop, index) => {
      const rawPath = prop.rawPath.trim();
      const alias = prop.alias.trim();
      const label = prop.label.trim();

      if (!rawPath || !alias || !label) {
        throw new ConflictException('prop의 rawPath, alias, label은 비어 있을 수 없습니다.');
      }

      return {
        rawPath,
        alias,
        label,
        type: prop.type,
        required: Boolean(prop.required),
        sample: this.nullableText(prop.sample),
        description: this.nullableText(prop.description),
        fallback: this.nullableText(prop.fallback),
        parserPipeline: this.normalizeParserPipeline(prop.parserPipeline),
        enabled: prop.enabled !== false,
        sortOrder: prop.sortOrder ?? index
      };
    });
  }

  private dedupeProps<T extends { rawPath: string }>(props: T[]): T[] {
    const byRawPath = new Map<string, T>();
    for (const prop of props) {
      const rawPath = prop.rawPath.trim();
      if (rawPath) {
        byRawPath.set(rawPath, prop);
      }
    }

    return Array.from(byRawPath.values());
  }

  private async ensureEventKeyAvailable(eventKey: string, currentId?: string) {
    const normalized = eventKey.trim();
    if (!normalized) {
      throw new ConflictException('eventKey는 비어 있을 수 없습니다.');
    }

    const existing = await this.prisma.publEventDefinition.findUnique({
      where: { eventKey: normalized },
      select: { id: true }
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException('같은 eventKey를 가진 Publ 이벤트가 이미 존재합니다.');
    }
  }

  private nullableText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeParserPipeline(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (!Array.isArray(value)) {
      throw new ConflictException('parserPipeline은 parser block 배열이어야 합니다.');
    }

    const steps = value.map((step, index) => {
      if (!this.isPlainJsonObject(step)) {
        throw new ConflictException(`parserPipeline ${index + 1}번째 block 형식을 확인해 주세요.`);
      }

      const type = step.type;
      if (typeof type !== 'string' || !PUBL_PARSER_STEP_TYPES.has(type)) {
        throw new ConflictException(`지원하지 않는 parser block입니다: ${String(type)}`);
      }

      return step as Prisma.InputJsonObject;
    });

    return steps as Prisma.InputJsonArray;
  }

  private isPlainJsonObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private serializeEvent(event: {
    id: string;
    catalogKey: string | null;
    eventKey: string;
    displayName: string;
    category: string;
    pAppCode: string | null;
    pAppName: string | null;
    triggerText: string | null;
    detailText: string | null;
    serviceStatus: string;
    locationType: string | null;
    locationId: string | null;
    sourceType: string | null;
    actionType: string | null;
    docsVersion: string | null;
    editable: boolean;
    createdAt: Date;
    updatedAt: Date;
    props: Array<{
      id: string;
      rawPath: string;
      alias: string;
      label: string;
      type: string;
      required: boolean;
      sample: string | null;
      description: string | null;
      fallback: string | null;
      parserPipeline: Prisma.JsonValue | null;
      enabled: boolean;
      sortOrder: number;
    }>;
  }) {
    return {
      id: event.id,
      catalogKey: event.catalogKey,
      eventKey: event.eventKey,
      displayName: event.displayName,
      category: event.category,
      pAppCode: event.pAppCode,
      pAppName: event.pAppName,
      triggerText: event.triggerText,
      detailText: event.detailText,
      serviceStatus: event.serviceStatus,
      locationType: event.locationType,
      locationId: event.locationId,
      sourceType: event.sourceType,
      actionType: event.actionType,
      docsVersion: event.docsVersion,
      editable: event.editable,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      props: event.props.map((prop) => ({
        id: prop.id,
        rawPath: prop.rawPath,
        alias: prop.alias,
        label: prop.label,
        labelVariable: prop.label.replace(/\s+/g, ''),
        type: prop.type,
        required: prop.required,
        sample: prop.sample,
        description: prop.description,
        fallback: prop.fallback,
        parserPipeline: prop.parserPipeline,
        enabled: prop.enabled,
        sortOrder: prop.sortOrder
      }))
    };
  }
}
