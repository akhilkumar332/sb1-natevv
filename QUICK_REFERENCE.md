# BloodHub India - Quick Reference Guide

## 📋 Collections Overview

| Collection | Primary Use | Key Fields | Access Control |
|------------|-------------|------------|----------------|
| **users** | All user profiles | uid, role, bloodType, verified | User: Own data, Admin: All |
| **donations** | Blood donation records | donorId, hospitalId, bloodType, units | Donor/Hospital: Own, Admin: All |
| **bloodRequests** | Emergency & regular requests | bloodType, urgency, status, location | All: Read, Hospital: Create/Update |
| **bloodInventory** | Hospital blood stock | hospitalId, bloodType, units, batches | All: Read, Hospital: Write |
| **campaigns** | NGO campaigns & drives | ngoId, type, target, achieved | All: Read, NGO: Write |
| **appointments** | Scheduled donations | donorId, hospitalId, scheduledDate | Involved parties: R/W |
| **volunteers** | NGO volunteers | ngoId, userId, role, hours | NGO: R/W, Volunteer: Read |
| **partnerships** | Org partnerships | ngoId, partnerId, type | Partners: R/W |
| **notifications** | User alerts | userId, type, message | Owner: R/W |
| **badges** | Achievement badges | name, criteria, rarity | All: Read, Admin: Write |
| **userBadges** | Earned badges | userId, badgeId, earnedAt | All: Read, System: Write |
| **verificationRequests** | Org verification | userId, documents, status | Owner: R/W, Admin: Approve |
| **analytics** | Platform metrics | date, metrics | All: Read, Admin: Write |

## 🔑 User Roles & Capabilities

### 👤 Donor
- ✅ View/update profile
- ✅ View donation history
- ✅ Respond to blood requests
- ✅ Schedule appointments
- ✅ Join campaigns
- ✅ View badges & achievements

### 🏥 Hospital (Requires Verification)
- ✅ Manage blood inventory
- ✅ Create emergency requests
- ✅ Schedule donor appointments
- ✅ Track donors
- ✅ Partner with NGOs

### 🤝 NGO (Requires Verification)
- ✅ Create campaigns
- ✅ Manage volunteers
- ✅ Track partnerships
- ✅ View donor analytics
- ✅ Organize blood drives

### 👨‍💼 Admin
- ✅ Verify organizations
- ✅ Manage all users
- ✅ Monitor platform
- ✅ View all analytics
- ✅ System configuration

## 🔄 Common Data Flows

### Emergency Request Flow
```
Hospital → Create Request → Notify Matching Donors → Donor Responds →
Schedule Appointment → Donation Complete → Update Inventory → Award Badges
```

### Campaign Flow
```
NGO → Create Campaign → Invite Donors → Donors Register → Track Progress →
Complete Campaign → Generate Report → Award Badges
```

### Donation Flow
```
Donor → Schedule Appointment → Medical Check → Donate → Update History →
Update Inventory → Update Request (if applicable) → Award Badges
```

## 📊 Key Relationships

```
Donor (1) ←→ (N) Donations
Donor (1) ←→ (N) Appointments
Donor (N) ←→ (N) Campaigns
Donor (N) ←→ (N) Blood Requests (as responder)

Hospital (1) ←→ (N) Blood Inventory
Hospital (1) ←→ (N) Blood Requests (as creator)
Hospital (1) ←→ (N) Appointments
Hospital (1) ←→ (N) Donations (received)

NGO (1) ←→ (N) Campaigns
NGO (1) ←→ (N) Volunteers
NGO (1) ←→ (N) Partnerships

Admin (1) ←→ (N) Verification Requests (reviewed)
```

## 🔍 Essential Queries

### Find Emergency Requests
```typescript
bloodRequests
  .where('bloodType', '==', userBloodType)
  .where('status', '==', 'active')
  .where('urgency', '==', 'critical')
  .where('location.city', '==', userCity)
```

### Get Donation History
```typescript
donations
  .where('donorId', '==', userId)
  .orderBy('donationDate', 'desc')
  .limit(20)
```

### Check Inventory Status
```typescript
bloodInventory
  .where('hospitalId', '==', hospitalId)
  .where('status', 'in', ['low', 'critical'])
```

### Active Campaigns
```typescript
campaigns
  .where('status', '==', 'active')
  .where('location.city', '==', userCity)
  .where('type', '==', 'blood-drive')
```

## 🎯 Gamification System

### Donor Levels
- 🌱 New Donor (0 donations)
- 🎯 Rookie Donor (1-2 donations)
- ⭐ Regular Donor (3-9 donations)
- 🚀 Super Donor (10-24 donations)
- 🦸 Hero Donor (25-49 donations)
- 👑 Legend Donor (50-99 donations)
- 🏆 Champion Donor (100+ donations)

### Badge Categories
- **Milestone**: First donation, 10th donation, etc.
- **Achievement**: Emergency responder, Campaign star, etc.
- **Special**: World Blood Donor Day participant, etc.

### Points System
- Regular donation: 100 points
- Emergency response: 200 points
- Campaign participation: 150 points
- Referral: 50 points

## 🔒 Security Rules Summary

| Action | Donor | Hospital | NGO | Admin |
|--------|-------|----------|-----|-------|
| Read own data | ✅ | ✅ | ✅ | ✅ |
| Read all users | ❌ | ❌ | ❌ | ✅ |
| Create request | ❌ | ✅* | ❌ | ✅ |
| Create campaign | ❌ | ❌ | ✅* | ✅ |
| Update inventory | ❌ | ✅ | ❌ | ✅ |
| Verify orgs | ❌ | ❌ | ❌ | ✅ |
| View analytics | ✅ | ✅ | ✅ | ✅ |

*Requires verification

## 📱 Feature Implementation Checklist

### Phase 1: Foundation ✅
- [x] Database schema design
- [x] Security rules
- [x] User authentication
- [x] Role-based access

### Phase 2: Core Features
- [ ] Donor profile & history
- [ ] Hospital inventory management
- [ ] Blood request system
- [ ] Appointment scheduling
- [ ] NGO campaign creation
- [ ] Admin verification workflow

### Phase 3: Advanced Features
- [ ] Gamification system
- [ ] Real-time notifications
- [ ] Analytics dashboard
- [ ] Search & filters

### Phase 4: Enhancements
- [ ] Location-based search
- [ ] Multi-language support
- [ ] Email/SMS notifications
- [ ] Report generation

## 🚀 Quick Start Commands

### Create User (Registration)
```typescript
await setDoc(doc(db, 'users', userId), {
  uid: userId,
  email: email,
  role: 'donor',
  bloodType: 'O+',
  // ... other fields
  createdAt: serverTimestamp()
});
```

### Create Blood Request
```typescript
await addDoc(collection(db, 'bloodRequests'), {
  requesterId: hospitalId,
  bloodType: 'AB-',
  units: 2,
  urgency: 'critical',
  status: 'active',
  location: { city, state, latitude, longitude },
  requestedAt: serverTimestamp()
});
```

### Schedule Appointment
```typescript
await addDoc(collection(db, 'appointments'), {
  donorId: donorId,
  hospitalId: hospitalId,
  scheduledDate: appointmentDate,
  status: 'scheduled',
  createdAt: serverTimestamp()
});
```

### Record Donation
```typescript
await addDoc(collection(db, 'donations'), {
  donorId: donorId,
  hospitalId: hospitalId,
  bloodType: bloodType,
  units: 1,
  status: 'completed',
  donationDate: serverTimestamp()
});
```

## 📈 Analytics Metrics

### Daily Tracking
- New user registrations
- Total donations
- Active requests
- Campaign participation

### Performance KPIs
- Request fulfillment rate
- Average response time
- Donor retention rate
- Platform uptime

### Business Metrics
- Lives saved (donations × 3)
- Blood units collected
- Active campaigns
- Verified organizations

## 🔔 Notification Types

1. **Emergency Request** - Critical blood needed
2. **Appointment Reminder** - 24 hours before
3. **Campaign Invite** - New blood drive nearby
4. **Donation Confirmation** - Thank you message
5. **Badge Earned** - Achievement unlocked
6. **Verification Status** - Org approval/rejection
7. **Inventory Alert** - Low blood stock
8. **General Announcement** - Platform updates

## 🗺️ Location-Based Features

### Geo Queries
- Find nearby donors (within 50km)
- Search blood camps by location
- Emergency requests in area
- Hospital inventory nearby

### Required Fields
```typescript
location: {
  address: string,
  city: string,
  state: string,
  latitude: number,
  longitude: number
}
```

## 💡 Best Practices

### Do's ✅
- Use serverTimestamp() for dates
- Denormalize for read performance
- Implement pagination
- Cache frequently accessed data
- Use batch operations for multiple writes
- Add proper indexes for queries

### Don'ts ❌
- Store large arrays (>100 items)
- Make documents >1MB
- Use client-side timestamps
- Skip validation
- Fetch all documents at once
- Ignore security rules

## 📞 Support & Resources

- **Documentation**: See `DATABASE_ARCHITECTURE.md`
- **Security Rules**: Firestore console
- **Indexes**: Auto-created on first query
- **Monitoring**: Firebase console → Performance

---

**Last Updated**: June 2024
**Version**: 1.0
