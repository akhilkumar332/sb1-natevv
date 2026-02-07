/**
 * NGO Service
 *
 * Service layer for NGO-specific operations including:
 * - Campaign creation and management
 * - Volunteer management
 * - Partnership tracking
 * - Analytics and reporting
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Campaign,
  Volunteer,
  Partnership,
} from '../types/database.types';
import { extractQueryData, getServerTimestamp } from '../utils/firestore.utils';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errorHandler';

// ============================================================================
// CAMPAIGN MANAGEMENT
// ============================================================================

/**
 * Create a new campaign
 * @param campaign - Campaign data
 * @returns Created campaign ID
 */
export const createCampaign = async (
  campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Validate campaign data
    if (!campaign.title || !campaign.ngoId || !campaign.type) {
      throw new ValidationError('Invalid campaign data');
    }

    // Validate dates
    const startDate = campaign.startDate instanceof Date
      ? campaign.startDate
      : campaign.startDate.toDate();
    const endDate = campaign.endDate instanceof Date
      ? campaign.endDate
      : campaign.endDate.toDate();

    if (endDate <= startDate) {
      throw new ValidationError('End date must be after start date');
    }

    const docRef = await addDoc(collection(db, 'campaigns'), {
      ...campaign,
      achieved: 0,
      registeredDonors: [],
      confirmedDonors: [],
      volunteers: [],
      partnerHospitals: [],
      partnerOrganizations: [],
      createdAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to create campaign');
  }
};

/**
 * Get campaigns for an NGO
 * @param ngoId - NGO user ID
 * @param status - Filter by status (optional)
 * @returns Array of campaigns
 */
export const getNgoCampaigns = async (
  ngoId: string,
  status?: 'draft' | 'active' | 'upcoming' | 'completed' | 'cancelled'
): Promise<Campaign[]> => {
  try {
    let q;
    if (status) {
      q = query(
        collection(db, 'campaigns'),
        where('ngoId', '==', ngoId),
        where('status', '==', status),
        orderBy('startDate', 'desc'),
        limit(50)
      );
    } else {
      q = query(
        collection(db, 'campaigns'),
        where('ngoId', '==', ngoId),
        orderBy('startDate', 'desc'),
        limit(50)
      );
    }

    const snapshot = await getDocs(q);
    return extractQueryData<Campaign>(snapshot, ['startDate', 'endDate', 'createdAt', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch campaigns');
  }
};

/**
 * Get active campaigns
 * @param city - Filter by city (optional)
 * @returns Array of active campaigns
 */
export const getActiveCampaigns = async (city?: string): Promise<Campaign[]> => {
  try {
    let q;
    if (city) {
      q = query(
        collection(db, 'campaigns'),
        where('status', '==', 'active'),
        where('location.city', '==', city),
        orderBy('startDate', 'desc'),
        limit(20)
      );
    } else {
      q = query(
        collection(db, 'campaigns'),
        where('status', '==', 'active'),
        orderBy('startDate', 'desc'),
        limit(20)
      );
    }

    const snapshot = await getDocs(q);
    return extractQueryData<Campaign>(snapshot, ['startDate', 'endDate', 'createdAt', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch active campaigns');
  }
};

/**
 * Update campaign
 * @param campaignId - Campaign ID
 * @param updates - Fields to update
 */
export const updateCampaign = async (
  campaignId: string,
  updates: Partial<Campaign>
): Promise<void> => {
  try {
    // Remove fields that shouldn't be updated directly
    const { id, createdAt, createdBy, ...allowedUpdates } = updates;

    await updateDoc(doc(db, 'campaigns', campaignId), {
      ...allowedUpdates,
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    throw new DatabaseError('Failed to update campaign');
  }
};

/**
 * Archive campaign (sets status to cancelled)
 * @param campaignId - Campaign ID
 */
export const archiveCampaign = async (campaignId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'campaigns', campaignId), {
      status: 'cancelled',
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    throw new DatabaseError('Failed to archive campaign');
  }
};

/**
 * Delete campaign
 * @param campaignId - Campaign ID
 */
export const deleteCampaign = async (campaignId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'campaigns', campaignId));
  } catch (error) {
    throw new DatabaseError('Failed to delete campaign');
  }
};

/**
 * Register donor for campaign
 * @param campaignId - Campaign ID
 * @param donorId - Donor user ID
 */
export const registerDonorForCampaign = async (
  campaignId: string,
  donorId: string
): Promise<void> => {
  try {
    const campaignDoc = await getDoc(doc(db, 'campaigns', campaignId));
    if (!campaignDoc.exists()) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = { ...campaignDoc.data(), id: campaignDoc.id } as Campaign;

    // Check if already registered
    if (campaign.registeredDonors?.includes(donorId)) {
      throw new ValidationError('Donor already registered for this campaign');
    }

    const registeredDonors = [...(campaign.registeredDonors || []), donorId];

    await updateDoc(doc(db, 'campaigns', campaignId), {
      registeredDonors,
      updatedAt: getServerTimestamp(),
    });

    // Create notification for donor
    await addDoc(collection(db, 'notifications'), {
      userId: donorId,
      userRole: 'donor',
      type: 'campaign_invite',
      title: 'Campaign Registration Confirmed',
      message: `You have successfully registered for ${campaign.title}`,
      read: false,
      priority: 'medium',
      relatedId: campaignId,
      relatedType: 'campaign',
      createdAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to register donor for campaign');
  }
};

/**
 * Confirm donor attendance for campaign
 * @param campaignId - Campaign ID
 * @param donorId - Donor user ID
 */
export const confirmDonorAttendance = async (
  campaignId: string,
  donorId: string
): Promise<void> => {
  try {
    const campaignDoc = await getDoc(doc(db, 'campaigns', campaignId));
    if (!campaignDoc.exists()) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = { ...campaignDoc.data(), id: campaignDoc.id } as Campaign;

    // Check if registered
    if (!campaign.registeredDonors?.includes(donorId)) {
      throw new ValidationError('Donor is not registered for this campaign');
    }

    // Add to confirmed donors if not already confirmed
    if (!campaign.confirmedDonors?.includes(donorId)) {
      const confirmedDonors = [...(campaign.confirmedDonors || []), donorId];

      // Update achieved count if target type is donors
      const newAchieved = campaign.targetType === 'donors'
        ? confirmedDonors.length
        : campaign.achieved;

      await updateDoc(doc(db, 'campaigns', campaignId), {
        confirmedDonors,
        achieved: newAchieved,
        updatedAt: getServerTimestamp(),
      });
    }
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to confirm donor attendance');
  }
};

/**
 * Update campaign progress
 * @param campaignId - Campaign ID
 * @param achieved - New achieved value
 */
export const updateCampaignProgress = async (
  campaignId: string,
  achieved: number
): Promise<void> => {
  try {
    if (achieved < 0) {
      throw new ValidationError('Achieved value cannot be negative');
    }

    await updateDoc(doc(db, 'campaigns', campaignId), {
      achieved,
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to update campaign progress');
  }
};

/**
 * Get campaign statistics
 * @param campaignId - Campaign ID
 * @returns Campaign statistics
 */
export const getCampaignStats = async (campaignId: string) => {
  try {
    const campaignDoc = await getDoc(doc(db, 'campaigns', campaignId));
    if (!campaignDoc.exists()) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = { ...campaignDoc.data(), id: campaignDoc.id } as Campaign;

    const registeredCount = campaign.registeredDonors?.length || 0;
    const confirmedCount = campaign.confirmedDonors?.length || 0;
    const volunteerCount = campaign.volunteers?.length || 0;

    const progressPercentage = campaign.target > 0
      ? Math.round((campaign.achieved / campaign.target) * 100)
      : 0;

    const confirmationRate = registeredCount > 0
      ? Math.round((confirmedCount / registeredCount) * 100)
      : 0;

    return {
      registeredDonors: registeredCount,
      confirmedDonors: confirmedCount,
      volunteers: volunteerCount,
      target: campaign.target,
      achieved: campaign.achieved,
      progressPercentage,
      confirmationRate,
      status: campaign.status,
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to get campaign statistics');
  }
};

// ============================================================================
// VOLUNTEER MANAGEMENT
// ============================================================================

/**
 * Add a volunteer
 * @param volunteer - Volunteer data
 * @returns Created volunteer ID
 */
export const addVolunteer = async (
  volunteer: Omit<Volunteer, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Validate volunteer data
    if (!volunteer.userId || !volunteer.ngoId || !volunteer.name) {
      throw new ValidationError('Invalid volunteer data');
    }

    const docRef = await addDoc(collection(db, 'volunteers'), {
      ...volunteer,
      hoursContributed: 0,
      campaignsParticipated: 0,
      eventsOrganized: 0,
      lastActiveAt: getServerTimestamp(),
      createdAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to add volunteer');
  }
};

/**
 * Get volunteers for an NGO
 * @param ngoId - NGO user ID
 * @param status - Filter by status (optional)
 * @returns Array of volunteers
 */
export const getNgoVolunteers = async (
  ngoId: string,
  status?: 'active' | 'inactive'
): Promise<Volunteer[]> => {
  try {
    let q;
    if (status) {
      q = query(
        collection(db, 'volunteers'),
        where('ngoId', '==', ngoId),
        where('status', '==', status),
        orderBy('joinedAt', 'desc'),
        limit(100)
      );
    } else {
      q = query(
        collection(db, 'volunteers'),
        where('ngoId', '==', ngoId),
        orderBy('joinedAt', 'desc'),
        limit(100)
      );
    }

    const snapshot = await getDocs(q);
    return extractQueryData<Volunteer>(snapshot, ['joinedAt', 'lastActiveAt', 'createdAt', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch volunteers');
  }
};

/**
 * Update volunteer
 * @param volunteerId - Volunteer ID
 * @param updates - Fields to update
 */
export const updateVolunteer = async (
  volunteerId: string,
  updates: Partial<Volunteer>
): Promise<void> => {
  try {
    const { id, createdAt, ...allowedUpdates } = updates;

    await updateDoc(doc(db, 'volunteers', volunteerId), {
      ...allowedUpdates,
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    throw new DatabaseError('Failed to update volunteer');
  }
};

/**
 * Archive volunteer (sets status to inactive)
 * @param volunteerId - Volunteer ID
 */
export const archiveVolunteer = async (volunteerId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'volunteers', volunteerId), {
      status: 'inactive',
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    throw new DatabaseError('Failed to archive volunteer');
  }
};

/**
 * Delete volunteer
 * @param volunteerId - Volunteer ID
 */
export const deleteVolunteer = async (volunteerId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'volunteers', volunteerId));
  } catch (error) {
    throw new DatabaseError('Failed to delete volunteer');
  }
};

/**
 * Assign volunteer to campaign
 * @param campaignId - Campaign ID
 * @param volunteerId - Volunteer user ID
 */
export const assignVolunteerToCampaign = async (
  campaignId: string,
  volunteerId: string
): Promise<void> => {
  try {
    const campaignDoc = await getDoc(doc(db, 'campaigns', campaignId));
    if (!campaignDoc.exists()) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = { ...campaignDoc.data(), id: campaignDoc.id } as Campaign;

    if (campaign.volunteers?.includes(volunteerId)) {
      throw new ValidationError('Volunteer already assigned to this campaign');
    }

    const volunteers = [...(campaign.volunteers || []), volunteerId];

    await updateDoc(doc(db, 'campaigns', campaignId), {
      volunteers,
      updatedAt: getServerTimestamp(),
    });

    // Update volunteer's campaign participation count
    const volunteerQuery = query(
      collection(db, 'volunteers'),
      where('userId', '==', volunteerId),
      limit(1)
    );

    const volunteerSnapshot = await getDocs(volunteerQuery);
    if (!volunteerSnapshot.empty) {
      const volunteerDoc = volunteerSnapshot.docs[0];
      const volunteerData = { ...volunteerDoc.data(), id: volunteerDoc.id } as Volunteer;

      await updateDoc(volunteerDoc.ref, {
        campaignsParticipated: (volunteerData.campaignsParticipated || 0) + 1,
        lastActiveAt: getServerTimestamp(),
        updatedAt: getServerTimestamp(),
      });
    }
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to assign volunteer to campaign');
  }
};

/**
 * Log volunteer hours
 * @param volunteerId - Volunteer ID
 * @param hours - Hours to add
 */
export const logVolunteerHours = async (
  volunteerId: string,
  hours: number
): Promise<void> => {
  try {
    if (hours <= 0) {
      throw new ValidationError('Hours must be greater than 0');
    }

    const volunteerDoc = await getDoc(doc(db, 'volunteers', volunteerId));
    if (!volunteerDoc.exists()) {
      throw new NotFoundError('Volunteer not found');
    }

    const volunteer = { ...volunteerDoc.data(), id: volunteerDoc.id } as Volunteer;

    await updateDoc(doc(db, 'volunteers', volunteerId), {
      hoursContributed: (volunteer.hoursContributed || 0) + hours,
      lastActiveAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to log volunteer hours');
  }
};

// ============================================================================
// PARTNERSHIP MANAGEMENT
// ============================================================================

/**
 * Create a partnership
 * @param partnership - Partnership data
 * @returns Created partnership ID
 */
export const createPartnership = async (
  partnership: Omit<Partnership, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Validate partnership data
    if (!partnership.ngoId || !partnership.partnerId || !partnership.partnerType) {
      throw new ValidationError('Invalid partnership data');
    }

    const docRef = await addDoc(collection(db, 'partnerships'), {
      ...partnership,
      totalDonations: 0,
      totalCampaigns: 0,
      totalFundsContributed: 0,
      createdAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to create partnership');
  }
};

/**
 * Get partnerships for an NGO
 * @param ngoId - NGO user ID
 * @param status - Filter by status (optional)
 * @returns Array of partnerships
 */
export const getNgoPartnerships = async (
  ngoId: string,
  status?: 'active' | 'pending' | 'inactive'
): Promise<Partnership[]> => {
  try {
    let q;
    if (status) {
      q = query(
        collection(db, 'partnerships'),
        where('ngoId', '==', ngoId),
        where('status', '==', status),
        orderBy('startDate', 'desc'),
        limit(50)
      );
    } else {
      q = query(
        collection(db, 'partnerships'),
        where('ngoId', '==', ngoId),
        orderBy('startDate', 'desc'),
        limit(50)
      );
    }

    const snapshot = await getDocs(q);
    return extractQueryData<Partnership>(snapshot, ['startDate', 'endDate', 'createdAt', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch partnerships');
  }
};

/**
 * Update partnership
 * @param partnershipId - Partnership ID
 * @param updates - Fields to update
 */
export const updatePartnership = async (
  partnershipId: string,
  updates: Partial<Partnership>
): Promise<void> => {
  try {
    const { id, createdAt, ...allowedUpdates } = updates;

    await updateDoc(doc(db, 'partnerships', partnershipId), {
      ...allowedUpdates,
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    throw new DatabaseError('Failed to update partnership');
  }
};

/**
 * Archive partnership (sets status to inactive)
 * @param partnershipId - Partnership ID
 */
export const archivePartnership = async (partnershipId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'partnerships', partnershipId), {
      status: 'inactive',
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    throw new DatabaseError('Failed to archive partnership');
  }
};

/**
 * Delete partnership
 * @param partnershipId - Partnership ID
 */
export const deletePartnership = async (partnershipId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'partnerships', partnershipId));
  } catch (error) {
    throw new DatabaseError('Failed to delete partnership');
  }
};

/**
 * Add partner to campaign
 * @param campaignId - Campaign ID
 * @param partnerId - Partner ID
 * @param partnerType - Type of partner (hospital or organization)
 */
export const addPartnerToCampaign = async (
  campaignId: string,
  partnerId: string,
  partnerType: 'hospital' | 'organization'
): Promise<void> => {
  try {
    const campaignDoc = await getDoc(doc(db, 'campaigns', campaignId));
    if (!campaignDoc.exists()) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = { ...campaignDoc.data(), id: campaignDoc.id } as Campaign;

    const updateData: any = {};

    if (partnerType === 'hospital') {
      if (campaign.partnerHospitals?.includes(partnerId)) {
        throw new ValidationError('Hospital already added as partner');
      }
      updateData.partnerHospitals = [...(campaign.partnerHospitals || []), partnerId];
    } else {
      if (campaign.partnerOrganizations?.includes(partnerId)) {
        throw new ValidationError('Organization already added as partner');
      }
      updateData.partnerOrganizations = [...(campaign.partnerOrganizations || []), partnerId];
    }

    updateData.updatedAt = getServerTimestamp();

    await updateDoc(doc(db, 'campaigns', campaignId), updateData);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to add partner to campaign');
  }
};

// ============================================================================
// ANALYTICS AND REPORTING
// ============================================================================

/**
 * Get NGO analytics
 * @param ngoId - NGO user ID
 * @returns NGO analytics data
 */
export const getNgoAnalytics = async (ngoId: string) => {
  try {
    // Get all campaigns
    const campaigns = await getNgoCampaigns(ngoId);

    // Calculate campaign statistics
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

    // Calculate total impact
    const totalDonorsReached = campaigns.reduce((sum, c) =>
      sum + (c.registeredDonors?.length || 0), 0
    );
    const totalDonorsConfirmed = campaigns.reduce((sum, c) =>
      sum + (c.confirmedDonors?.length || 0), 0
    );

    // Get volunteers
    const volunteers = await getNgoVolunteers(ngoId);
    const activeVolunteers = volunteers.filter(v => v.status === 'active').length;
    const totalVolunteerHours = volunteers.reduce((sum, v) =>
      sum + (v.hoursContributed || 0), 0
    );

    // Get partnerships
    const partnerships = await getNgoPartnerships(ngoId);
    const activePartnerships = partnerships.filter(p => p.status === 'active').length;

    // Campaign performance
    const campaignsByType = campaigns.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      campaigns: {
        total: totalCampaigns,
        active: activeCampaigns,
        completed: completedCampaigns,
        byType: campaignsByType,
      },
      donors: {
        reached: totalDonorsReached,
        confirmed: totalDonorsConfirmed,
        confirmationRate: totalDonorsReached > 0
          ? Math.round((totalDonorsConfirmed / totalDonorsReached) * 100)
          : 0,
      },
      volunteers: {
        total: volunteers.length,
        active: activeVolunteers,
        totalHours: totalVolunteerHours,
      },
      partnerships: {
        total: partnerships.length,
        active: activePartnerships,
      },
    };
  } catch (error) {
    throw new DatabaseError('Failed to get NGO analytics');
  }
};

/**
 * Get campaign performance report
 * @param campaignId - Campaign ID
 * @returns Campaign performance data
 */
export const getCampaignPerformanceReport = async (campaignId: string) => {
  try {
    const stats = await getCampaignStats(campaignId);

    const campaignDoc = await getDoc(doc(db, 'campaigns', campaignId));
    if (!campaignDoc.exists()) {
      throw new NotFoundError('Campaign not found');
    }

    const campaign = { ...campaignDoc.data(), id: campaignDoc.id } as Campaign;

    // Calculate duration
    const startDate = campaign.startDate instanceof Date
      ? campaign.startDate
      : campaign.startDate.toDate();
    const endDate = campaign.endDate instanceof Date
      ? campaign.endDate
      : campaign.endDate.toDate();
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check if campaign has started
    const hasStarted = startDate <= new Date();
    const hasEnded = endDate <= new Date();

    return {
      ...stats,
      campaign: {
        title: campaign.title,
        type: campaign.type,
        status: campaign.status,
        startDate,
        endDate,
        durationDays,
        hasStarted,
        hasEnded,
      },
      partners: {
        hospitals: campaign.partnerHospitals?.length || 0,
        organizations: campaign.partnerOrganizations?.length || 0,
      },
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to get campaign performance report');
  }
};
