const { getSupabaseClient } = require('../config/supabase');

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function timestamp(value) {
  return value || new Date().toISOString();
}

const COLLECTIONS = {
  'users.json': {
    table: 'users',
    toRow: item => ({
      id: item.id,
      full_name: item.fullName || '',
      email: item.email || '',
      password_hash: item.passwordHash || '',
      role: item.role || 'user',
      created_at: timestamp(item.createdAt),
      updated_at: timestamp(item.updatedAt)
    }),
    fromRow: row => ({
      id: row.id,
      fullName: row.full_name || '',
      email: row.email || '',
      passwordHash: row.password_hash || '',
      role: row.role || 'user',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  },
  'userProfiles.json': {
    table: 'user_profiles',
    toRow: item => ({
      id: item.id,
      user_id: item.userId,
      country: item.country || '',
      city: item.city || '',
      profession: item.profession || '',
      education_level: item.educationLevel || '',
      skills: toArray(item.skills),
      business_type: item.businessType || '',
      business_stage: item.businessStage || '',
      sector_interests: toArray(item.sectorInterests),
      funding_needs: item.fundingNeeds || '',
      travel_available: !!item.travelAvailable,
      passport_available: !!item.passportAvailable,
      business_registered: !!item.businessRegistered,
      preferred_opportunity_types: toArray(item.preferredOpportunityTypes),
      bio: item.bio || '',
      portfolio_links: toArray(item.portfolioLinks),
      created_at: timestamp(item.createdAt),
      updated_at: timestamp(item.updatedAt)
    }),
    fromRow: row => ({
      id: row.id,
      userId: row.user_id,
      country: row.country || '',
      city: row.city || '',
      profession: row.profession || '',
      educationLevel: row.education_level || '',
      skills: toArray(row.skills),
      businessType: row.business_type || '',
      businessStage: row.business_stage || '',
      sectorInterests: toArray(row.sector_interests),
      fundingNeeds: row.funding_needs || '',
      travelAvailable: !!row.travel_available,
      passportAvailable: !!row.passport_available,
      businessRegistered: !!row.business_registered,
      preferredOpportunityTypes: toArray(row.preferred_opportunity_types),
      bio: row.bio || '',
      portfolioLinks: toArray(row.portfolio_links),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  },
  'opportunities.json': {
    table: 'opportunities',
    toRow: item => ({
      id: item.id,
      title: item.title || '',
      organisation: item.organisation || '',
      category: item.category || '',
      description: item.description || '',
      country_scope: item.countryScope || '',
      location: item.location || '',
      deadline: item.deadline === undefined ? null : item.deadline,
      funding_amount: item.fundingAmount || '',
      benefits: item.benefits || '',
      eligibility: item.eligibility || '',
      required_documents: item.requiredDocuments || '',
      application_steps: item.applicationSteps || '',
      application_link: item.applicationLink || '',
      source_url: item.sourceUrl || '',
      risk_level: item.riskLevel || 'unverified',
      status: item.status || 'draft',
      created_by_user_id: item.createdByUserId || null,
      visibility: item.visibility || 'public',
      source_citations: toArray(item.sourceCitations),
      raw_research_text: item.rawResearchText || '',
      created_at: timestamp(item.createdAt),
      updated_at: timestamp(item.updatedAt)
    }),
    fromRow: row => ({
      id: row.id,
      title: row.title || '',
      organisation: row.organisation || '',
      category: row.category || '',
      description: row.description || '',
      countryScope: row.country_scope || '',
      location: row.location || '',
      deadline: row.deadline,
      fundingAmount: row.funding_amount || '',
      benefits: row.benefits || '',
      eligibility: row.eligibility || '',
      requiredDocuments: row.required_documents || '',
      applicationSteps: row.application_steps || '',
      applicationLink: row.application_link || '',
      sourceUrl: row.source_url || '',
      riskLevel: row.risk_level || 'unverified',
      status: row.status || 'draft',
      createdByUserId: row.created_by_user_id || null,
      visibility: row.visibility || 'public',
      sourceCitations: toArray(row.source_citations),
      rawResearchText: row.raw_research_text || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  },
  'userDocuments.json': {
    table: 'user_documents',
    toRow: item => ({
      id: item.id,
      user_id: item.userId,
      document_type: item.documentType || '',
      original_name: item.originalName || '',
      stored_name: item.storedName || '',
      file_path: item.filePath || '',
      mime_type: item.mimeType || '',
      size: Number(item.size) || 0,
      status: item.status || 'uploaded',
      created_at: timestamp(item.createdAt),
      updated_at: timestamp(item.updatedAt)
    }),
    fromRow: row => ({
      id: row.id,
      userId: row.user_id,
      documentType: row.document_type || '',
      originalName: row.original_name || '',
      storedName: row.stored_name || '',
      filePath: row.file_path || '',
      mimeType: row.mime_type || '',
      size: Number(row.size) || 0,
      status: row.status || 'uploaded',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  },
  'userOpportunityMatches.json': {
    table: 'user_opportunity_matches',
    toRow: item => ({
      id: item.id,
      user_id: item.userId,
      opportunity_id: item.opportunityId,
      match_score: Number(item.matchScore) || 0,
      match_level: item.matchLevel || 'not_recommended',
      eligibility_status: item.eligibilityStatus || 'unclear',
      eligibility_score: Number(item.eligibilityScore) || 0,
      relevance_score: Number(item.relevanceScore) || 0,
      readiness_score: Number(item.readinessScore) || 0,
      urgency_score: Number(item.urgencyScore) || 0,
      value_score: Number(item.valueScore) || 0,
      match_reasons: toArray(item.matchReasons),
      possible_concerns: toArray(item.possibleConcerns),
      available_documents: toArray(item.availableDocuments),
      missing_documents: toArray(item.missingDocuments),
      recommended_next_steps: toArray(item.recommendedNextSteps),
      status: item.status || 'new',
      ai_enhanced: !!item.aiEnhanced,
      created_at: timestamp(item.createdAt),
      updated_at: timestamp(item.updatedAt)
    }),
    fromRow: row => ({
      id: row.id,
      userId: row.user_id,
      opportunityId: row.opportunity_id,
      matchScore: Number(row.match_score) || 0,
      matchLevel: row.match_level || 'not_recommended',
      eligibilityStatus: row.eligibility_status || 'unclear',
      eligibilityScore: Number(row.eligibility_score) || 0,
      relevanceScore: Number(row.relevance_score) || 0,
      readinessScore: Number(row.readiness_score) || 0,
      urgencyScore: Number(row.urgency_score) || 0,
      valueScore: Number(row.value_score) || 0,
      matchReasons: toArray(row.match_reasons),
      possibleConcerns: toArray(row.possible_concerns),
      availableDocuments: toArray(row.available_documents),
      missingDocuments: toArray(row.missing_documents),
      recommendedNextSteps: toArray(row.recommended_next_steps),
      status: row.status || 'new',
      aiEnhanced: !!row.ai_enhanced,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  },
  'actionSteps.json': {
    table: 'action_steps',
    toRow: item => ({
      id: item.id,
      user_id: item.userId,
      opportunity_id: item.opportunityId,
      title: item.title || '',
      description: item.description || '',
      status: item.status || 'not_started',
      priority: item.priority || 'medium',
      created_at: timestamp(item.createdAt),
      updated_at: timestamp(item.updatedAt)
    }),
    fromRow: row => ({
      id: row.id,
      userId: row.user_id,
      opportunityId: row.opportunity_id,
      title: row.title || '',
      description: row.description || '',
      status: row.status || 'not_started',
      priority: row.priority || 'medium',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  }
};

function getCollection(fileName) {
  const collection = COLLECTIONS[fileName];
  if (!collection) {
    throw new Error(`No Supabase structured table mapping for ${fileName}`);
  }
  return collection;
}

async function readStructuredCollection(fileName) {
  const collection = getCollection(fileName);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(collection.table)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Supabase read failed for ${fileName}: ${error.message}`);
  }

  return (data || []).map(collection.fromRow);
}

async function writeStructuredCollection(fileName, records) {
  if (!Array.isArray(records)) {
    throw new Error(`writeStructuredCollection expected an array for ${fileName}`);
  }

  const collection = getCollection(fileName);
  const supabase = getSupabaseClient();
  const rows = records.map(collection.toRow);
  const keepIds = new Set(rows.map(row => row.id).filter(Boolean).map(String));

  const { data: existing, error: readError } = await supabase
    .from(collection.table)
    .select('id');

  if (readError) {
    throw new Error(`Supabase read failed for ${fileName}: ${readError.message}`);
  }

  const deleteIds = (existing || [])
    .map(row => row.id)
    .filter(id => !keepIds.has(String(id)));

  if (deleteIds.length) {
    const { error: deleteError } = await supabase
      .from(collection.table)
      .delete()
      .in('id', deleteIds);
    if (deleteError) {
      throw new Error(`Supabase delete failed for ${fileName}: ${deleteError.message}`);
    }
  }

  if (rows.length) {
    const { error: upsertError } = await supabase
      .from(collection.table)
      .upsert(rows, { onConflict: 'id' });
    if (upsertError) {
      throw new Error(`Supabase write failed for ${fileName}: ${upsertError.message}`);
    }
  }
}

async function upsertStructuredCollection(fileName, records) {
  if (!Array.isArray(records)) {
    throw new Error(`upsertStructuredCollection expected an array for ${fileName}`);
  }

  if (!records.length) return;

  const collection = getCollection(fileName);
  const supabase = getSupabaseClient();
  const rows = records.map(collection.toRow);
  const { error } = await supabase
    .from(collection.table)
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    throw new Error(`Supabase import failed for ${fileName}: ${error.message}`);
  }
}

module.exports = {
  COLLECTIONS,
  readStructuredCollection,
  upsertStructuredCollection,
  writeStructuredCollection
};
