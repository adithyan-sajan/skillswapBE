// controllers/requestController.js
const SwapRequest = require('../models/SwapRequest');
const SkillListing = require('../models/SkillListing');

// 1. CREATE A REQUEST
exports.createRequest = async (req, res) => {
  try {
    const { listingId, message } = req.body;
    const senderId = req.user._id;

    // Find the listing to know who the receiver is
    const listing = await SkillListing.findById(listingId);
    if (!listing) return res.status(404).json({ message: "Listing not found" });

    // Prevent users from requesting their own listings
    if (listing.hostId.toString() === senderId.toString()) {
      return res.status(400).json({ message: "You cannot request your own listing." });
    }

    // Check if a pending request already exists between these two for this listing
    const existingRequest = await SwapRequest.findOne({ senderId, listingId, status: 'Pending' });
    if (existingRequest) {
      return res.status(400).json({ message: "You already have a pending request for this." });
    }

    const newRequest = await SwapRequest.create({
      senderId,
      receiverId: listing.hostId,
      listingId,
      message
    });

    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ message: "Failed to send request", error: error.message });
  }
};

// 2. GET ALL MY REQUESTS (Incoming & Outgoing)
exports.getMyRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find requests where the user is EITHER the sender OR the receiver
    const requests = await SwapRequest.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    })
    .populate('senderId', 'username avatarUrl')
    .populate('receiverId', 'username avatarUrl')
    .populate('listingId', 'title costPerHour')
    .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch requests", error: error.message });
  }
};

// 3. UPDATE REQUEST STATUS (Accept/Reject)
exports.updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'Accepted' or 'Rejected'
    const userId = req.user._id;

    const request = await SwapRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    // Security Check: Only the receiver (the host) can accept/reject
    if (request.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to update this request." });
    }

    request.status = status;
    await request.save();

    res.status(200).json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to update request", error: error.message });
  }
};