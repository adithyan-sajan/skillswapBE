const TradeRequest = require('../models/TradeRequest');
const SkillListing = require('../models/SkillListing');

exports.createRequest = async (req, res) => {
  try {
    const { skillListingId, message } = req.body;
    const listing = await SkillListing.findById(skillListingId);
    
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    const newRequest = await TradeRequest.create({
      skillListingId,
      hostId: listing.hostId, // The person who owns the skill
      seekerId: req.user._id, // The logged-in user
      message
    });

    res.status(201).json(newRequest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};