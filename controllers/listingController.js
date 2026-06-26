const SkillListing = require('../models/SkillListing');

// 1. DEPLOY A NEW NODE (Used by the Profile tab)
exports.createListing = async (req, res) => {
  try {
    const { title, category, description, level, costPerHour } = req.body;

    const newListing = await SkillListing.create({
      hostId: req.user._id, // Provided by the authMiddleware
      title,
      category,
      description,
      level,
      costPerHour,
      status: 'Active'
    });

    res.status(201).json(newListing);
  } catch (error) {
    res.status(500).json({ message: "Failed to deploy listing", error: error.message });
  }
};

// 2. FETCH MY NODES (Used by the Dashboard)
exports.getMyListings = async (req, res) => {
  try {
    // Find all listings belonging to the logged-in user
    const myListings = await SkillListing.find({ hostId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(myListings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch your listings" });
  }
};

// 3. FETCH EXPLORE NODES (Used by the Explore Page)
exports.getAllListings = async (req, res) => {
  try {
    // Fetch all active listings NOT owned by the current user
    const listings = await SkillListing.find({ 
      hostId: { $ne: req.user._id }, 
      isActive: true 
    }).populate('hostId', 'username avatarUrl rating'); // Pull in the host's identity
    
    res.status(200).json(listings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch marketplace data" });
  }
};