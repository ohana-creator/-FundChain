// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FundChain
 * @author github.com/obento
 * @notice Decentralized crowdfunding platform on Ethereum.
 *         Campaigns are funded in ETH. Funds are only released
 *         to the owner if the goal is met before the deadline.
 *         Contributors can claim refunds if the campaign fails.
 *         Version 2
 */
contract FundChain {
    // ─────────────────────────────────────────────
    //  Types
    // ─────────────────────────────────────────────
    struct Campaign {
        uint256 id;
        address payable owner;
        string  title;
        string  description;
        uint256 goal;          // in wei
        uint256 deadline;      // unix timestamp
        uint256 raised;
        bool    claimed;
        bool    exists;
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────
    uint256 public campaignCount;
    mapping(uint256 => Campaign)                     public campaigns;
    mapping(uint256 => mapping(address => uint256))  public contributions;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────
    event CampaignCreated(
        uint256 indexed id,
        address indexed owner,
        string  title,
        uint256 goal,
        uint256 deadline
    );
    event Funded(
        uint256 indexed campaignId,
        address indexed contributor,
        uint256 amount,
        uint256 totalRaised
    );
    event FundsClaimed(uint256 indexed campaignId, address indexed owner, uint256 amount);
    event Refunded(uint256 indexed campaignId, address indexed contributor, uint256 amount);

    // ─────────────────────────────────────────────
    //  Errors
    // ─────────────────────────────────────────────
    error CampaignNotFound();
    error DeadlineMustBeInFuture();
    error GoalMustBePositive();
    error TitleTooShort();
    error CampaignEnded();
    error CampaignNotEnded();
    error GoalNotReached();
    error GoalAlreadyReached();
    error AlreadyClaimed();
    error NothingToRefund();
    error NotOwner();
    error ZeroContribution();

    // ─────────────────────────────────────────────
    //  Write Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Create a new fundraising campaign.
     * @param title       Campaign title (min 5 chars)
     * @param description Campaign description
     * @param goal        Funding goal in wei
     * @param durationDays Campaign duration in days
     */
    function createCampaign(
        string calldata title,
        string calldata description,
        uint256 goal,
        uint256 durationDays
    ) external returns (uint256) {
        if (bytes(title).length < 5)  revert TitleTooShort();
        if (goal == 0)                revert GoalMustBePositive();
        if (durationDays == 0)        revert DeadlineMustBeInFuture();

        uint256 id = ++campaignCount;
        campaigns[id] = Campaign({
            id:          id,
            owner:       payable(msg.sender),
            title:       title,
            description: description,
            goal:        goal,
            deadline:    block.timestamp + (durationDays * 1 days),
            raised:      0,
            claimed:     false,
            exists:      true
        });

        emit CampaignCreated(id, msg.sender, title, goal, campaigns[id].deadline);
        return id;
    }

    /**
     * @notice Contribute ETH to a campaign.
     * @param campaignId ID of the campaign to fund
     */
    function fund(uint256 campaignId) external payable {
        Campaign storage c = _getCampaign(campaignId);
        if (block.timestamp >= c.deadline) revert CampaignEnded();
        if (msg.value == 0)               revert ZeroContribution();

        c.raised                              += msg.value;
        contributions[campaignId][msg.sender] += msg.value;

        emit Funded(campaignId, msg.sender, msg.value, c.raised);
    }

    /**
     * @notice Owner claims funds after a successful campaign.
     *         Only callable after deadline if goal was reached.
     * @param campaignId ID of the campaign
     */
    function claimFunds(uint256 campaignId) external {
        Campaign storage c = _getCampaign(campaignId);
        if (msg.sender != c.owner)          revert NotOwner();
        if (block.timestamp < c.deadline)   revert CampaignNotEnded();
        if (c.raised < c.goal)              revert GoalNotReached();
        if (c.claimed)                      revert AlreadyClaimed();

        c.claimed = true;
        uint256 amount = c.raised;
        c.owner.transfer(amount);

        emit FundsClaimed(campaignId, msg.sender, amount);
    }

    /**
     * @notice Contributor claims a refund if campaign failed.
     *         Only callable after deadline if goal was NOT reached.
     * @param campaignId ID of the campaign
     */
    function refund(uint256 campaignId) external {
        Campaign storage c = _getCampaign(campaignId);
        if (block.timestamp < c.deadline)   revert CampaignNotEnded();
        if (c.raised >= c.goal)             revert GoalAlreadyReached();

        uint256 amount = contributions[campaignId][msg.sender];
        if (amount == 0) revert NothingToRefund();

        contributions[campaignId][msg.sender] = 0;
        payable(msg.sender).transfer(amount);

        emit Refunded(campaignId, msg.sender, amount);
    }

    // ─────────────────────────────────────────────
    //  Read Functions
    // ─────────────────────────────────────────────

    function getCampaign(uint256 campaignId) external view returns (Campaign memory) {
        return _getCampaign(campaignId);
    }

    function getContribution(uint256 campaignId, address contributor) external view returns (uint256) {
        return contributions[campaignId][contributor];
    }

    function isActive(uint256 campaignId) external view returns (bool) {
        Campaign storage c = _getCampaign(campaignId);
        return block.timestamp < c.deadline && c.raised < c.goal;
    }

    function getProgress(uint256 campaignId) external view returns (uint256 percent) {
        Campaign storage c = _getCampaign(campaignId);
        if (c.goal == 0) return 0;
        return (c.raised * 100) / c.goal;
    }

    // ─────────────────────────────────────────────
    //  Internal
    // ─────────────────────────────────────────────
    function _getCampaign(uint256 id) internal view returns (Campaign storage) {
        if (!campaigns[id].exists) revert CampaignNotFound();
        return campaigns[id];
    }
}
