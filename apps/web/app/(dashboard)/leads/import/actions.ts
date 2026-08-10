"use server";

import { revalidatePath } from "next/cache";
import { assertPermission, ForbiddenError } from "@virtelon/core/rbac";
import { CsvImportAdapter, getOrCreateLeadSource, ingestDiscoveredLeads } from "@virtelon/core/lead-discovery";
import { scoreLeads } from "@virtelon/core/lead-scoring";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";

export type ImportCsvState = {
  error?: string;
  success?: boolean;
  totalRows?: number;
  imported?: number;
  duplicates?: number;
  errorCount?: number;
};

const adapter = new CsvImportAdapter();

export async function importCsv(_prev: ImportCsvState, formData: FormData): Promise<ImportCsvState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "lead:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to import leads." };
    throw error;
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a CSV file." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const db = tenantDb(user);
  const source = await getOrCreateLeadSource(db, user.organizationId, "csv_import");

  const batch = await db.leadImportBatch.create({
    data: {
      organizationId: user.organizationId,
      sourceId: source.id,
      fileName: file.name,
      status: "PROCESSING",
      createdByUserId: user.userId,
    },
  });

  const { leads, errors } = await adapter.parse({
    file: { buffer, filename: file.name, mimeType: file.type },
    defaultCountry: "IN",
  });

  const ingestResult = await ingestDiscoveredLeads(
    db,
    { organizationId: user.organizationId, sourceId: source.id, defaultCountry: "IN" },
    leads
  );
  await scoreLeads(db, ingestResult.leadIds);

  await db.leadImportBatch.update({
    where: { id: batch.id },
    data: {
      status: "COMPLETED",
      totalRows: leads.length + errors.length,
      importedCount: ingestResult.createdCount + ingestResult.updatedCount,
      duplicateCount: ingestResult.duplicateCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      completedAt: new Date(),
    },
  });

  revalidatePath("/leads");
  revalidatePath("/leads/import");

  return {
    success: true,
    totalRows: leads.length + errors.length,
    imported: ingestResult.createdCount + ingestResult.updatedCount,
    duplicates: ingestResult.duplicateCount,
    errorCount: errors.length,
  };
}
