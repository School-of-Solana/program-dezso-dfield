import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Event } from '../target/types/event';
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { expect } from "chai";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAccount, getMint, getAssociatedTokenAddressSync, createMint, getOrCreateAssociatedTokenAccount} from "@solana/spl-token";

describe("event", () => {
  
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.event as Program<Event>;
  const wallet = provider.wallet as anchor.Wallet;

  const EVENT_ID = new anchor.BN(1);

  let eventPda: PublicKey;
  let eventBump: number;

  before(async () => {
    [eventPda,eventBump] = PublicKey.findProgramAddressSync([
        Buffer.from("event"),
        wallet.publicKey.toBuffer(),
        EVENT_ID.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  });

  describe("init_event", async () => {
    const priceLamports = new anchor.BN(LAMPORTS_PER_SOL);

    it("Creates an event with correct fields", async () => {
      const title = "Hello Event!";
      const description = "Welcome to my new test event!";

      await program.methods
        .initEvent(EVENT_ID, priceLamports, title, description)
        .accounts({
          signer: wallet.publicKey,
          event: eventPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const eventAccount = await program.account.event.fetch(eventPda);

      expect(eventAccount.price.toNumber()).to.equal(
        priceLamports.toNumber()
      );
      expect(eventAccount.title).to.equal(title);
      expect(eventAccount.description).to.equal(description);
      expect(eventAccount.eventId.toNumber()).to.equal(EVENT_ID.toNumber());
      expect(eventAccount.organizer.toBase58()).to.equal(
        wallet.publicKey.toBase58()
      );
    });

    it("Fails if event PDA is already initialized", async () => {
      const title = "Duplicate Event";
      const description = "Duplicate event description";

      let isError = false;

      try {
        await program.methods
          .initEvent(EVENT_ID, priceLamports, title, description)
          .accounts({
            signer: wallet.publicKey,
            event: eventPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } catch (err) {
        isError = true;
        expect(err).to.have.property("logs");
      }
      expect(isError).to.be.true;
    });
  });

  describe("init_ticket", () => {
    it("Creates a ticket for the event", async () => {
      const owner = wallet.publicKey;

      const [ticketPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ticket"),
            eventPda.toBuffer(),
            owner.toBuffer(),
          ],
          program.programId,
      );

      await program.methods
        .initTicket()
        .accounts({
          signer: wallet.publicKey,
          event: eventPda,
          ticket: ticketPda,
          owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const ticketAccount = await program.account.ticket.fetch(ticketPda);

      const zeroPk = new PublicKey(new Uint8Array(32));

      expect(ticketAccount.owner.toBase58()).to.equal(owner.toBase58());
      expect(ticketAccount.event.toBase58()).to.equal(eventPda.toBase58());
      expect(ticketAccount.mint.toBase58()).to.equal(zeroPk.toBase58());
      expect(ticketAccount.checkedIn).to.be.false;
    });

    it("Failes if the event is not valid", async () => {
      const noEvent = SystemProgram.programId;

      const [noEventPda] = PublicKey.findProgramAddressSync([
          Buffer.from("ticket"),
          noEvent.toBuffer(),
          wallet.publicKey.toBuffer(),
        ],program.programId);

      let isError = false;

      try {
        await program.methods
          .initTicket()
          .accounts({
            signer: wallet.publicKey,
            event: noEvent,
            ticket: noEventPda,
            owner: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } catch(err) {
        isError = true;
        expect(err).to.have.property("logs");
      }
      expect(isError).to.be.true;
    });
  });

  describe("check_in", async () => {
    const EVENT_ID_2 = new anchor.BN(2);;

    let checkInEventPda: PublicKey;
    let checkInTicketPda: PublicKey;

    before(async () => {
      [checkInEventPda] = PublicKey.findProgramAddressSync([
          Buffer.from("event"),
          wallet.publicKey.toBuffer(),
          EVENT_ID_2.toArrayLike(Buffer, "le", 8),
      ], program.programId);

      const price = new anchor.BN(0);
      const title = "Check In event";
      const description = "Checked in event description";

      await program.methods
        .initEvent(EVENT_ID_2,price,title,description)
        .accounts({
          signer: wallet.publicKey,
          event: checkInEventPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      [checkInTicketPda] = PublicKey.findProgramAddressSync([
        Buffer.from("ticket"),
        checkInEventPda.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],program.programId);

      await program.methods
        .initTicket()
        .accounts({
          signer: wallet.publicKey,
          event: checkInEventPda,
          ticket: checkInTicketPda,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("Checks in a ticket", async () => {
      await program.methods
        .checkIn()
        .accounts({
          signer: wallet.publicKey,
          event: checkInEventPda,
          ticket: checkInTicketPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      const ticketAccount = await program.account.ticket.fetch(checkInTicketPda);
      expect(ticketAccount.checkedIn).to.be.true;
    });

    it("Fails if the ticket has already been checked in", async () => {
      let isError = false;
      try {
        await program.methods
          .checkIn()
          .accounts({
            signer: wallet.publicKey,
            event: checkInEventPda,
            ticket: checkInTicketPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } catch(err) {
        isError = true;
        expect(err).to.have.property("logs");
      }
      expect(isError).to.be.true;
    });

    it("Fails if the ticket is for a different event", async () => {
      const EVENT_ID_3 = new anchor.BN(3);
      const price = new anchor.BN(0);
      const title = "Other event";
      const description = "Other event description";
      const [otherEventPda] = PublicKey.findProgramAddressSync([
        Buffer.from("event"),
        wallet.publicKey.toBuffer(),
        EVENT_ID_3.toArrayLike(Buffer, "le", 8),
      ], program.programId);

      await program.methods
        .initEvent(EVENT_ID_3,price,title,description)
        .accounts({
          signer: wallet.publicKey,
          event: otherEventPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      let isError = false;

      try {
        await program.methods
          .checkIn()
          .accounts({
            signer: wallet.publicKey,
            event: otherEventPda,
            ticket: checkInTicketPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } catch(err) {
        isError = true;
        expect(err).to.have.property("logs");;
      }
      expect(isError).to.be.true;
    });
  });

  describe("withdraw", async () => {
    const EVENT_ID_WITHDRAW = new anchor.BN(10);
    const EVENT_ID_UNAUTH = new anchor.BN(11);
    const EVENT_ID_NOFUNDS = new anchor.BN(12);

    let withdrawEventPda: PublicKey;
    let unauthEventPda: PublicKey;
    let noFundsEventPda: PublicKey;

    before(async () => {
      [withdrawEventPda] = PublicKey.findProgramAddressSync([
        Buffer.from("event"),
        wallet.publicKey.toBuffer(),
        EVENT_ID_WITHDRAW.toArrayLike(Buffer, "le", 8),
      ],program.programId);

      const zeroPrice = new anchor.BN(0);


      await program.methods
        .initEvent(EVENT_ID_WITHDRAW,zeroPrice,"Zero Event","Zero Event description")
        .accounts({
          signer: wallet.publicKey,
          event: withdrawEventPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const depositLamports = LAMPORTS_PER_SOL / 2;

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: withdrawEventPda,
          lamports: depositLamports,
        })
      );

      await provider.sendAndConfirm(tx, []);

      [unauthEventPda] = PublicKey.findProgramAddressSync([
        Buffer.from("event"),
        wallet.publicKey.toBuffer(),
        EVENT_ID_UNAUTH.toArrayLike(Buffer, "le", 8),
      ],program.programId);

      await program.methods
        .initEvent(EVENT_ID_UNAUTH,zeroPrice,"Unauth Event", "Unauth event description")
        .accounts({
          signer: wallet.publicKey,
          event: unauthEventPda,
          systemProgram: SystemProgram.programId
        })  
        .rpc();

      [noFundsEventPda] = PublicKey.findProgramAddressSync([
        Buffer.from("event"),
        wallet.publicKey.toBuffer(),
        EVENT_ID_NOFUNDS.toArrayLike(Buffer, "le", 8),
      ],program.programId);

      await program.methods
        .initEvent(EVENT_ID_NOFUNDS,zeroPrice,"NoFunds Event", "NoFunds event description")
        .accounts({
          signer: wallet.publicKey,
          event: noFundsEventPda,
          systemProgram: SystemProgram.programId
        })  
        .rpc();
    });

    it("Withdraws funds to the event organizer", async () => {
      const preEvent = await provider.connection.getAccountInfo(withdrawEventPda);
      if (!preEvent) throw new Error("Event Account not found");

      const preLamports = preEvent.lamports;
      const rent = await provider.connection.getMinimumBalanceForRentExemption(
        preEvent.data.length
      );
      const available = preLamports - rent;
      expect(available).to.be.greaterThan(0);

      const withdrawAmount = new anchor.BN(available / 2);

      await program.methods
        .withdraw(withdrawAmount)
        .accounts({
          signer: wallet.publicKey,
          event: withdrawEventPda,
        })
        .rpc();

      const postEvent = await provider.connection.getAccountInfo(withdrawEventPda);
      if (!postEvent) throw new Error("Event Account not found after withdrawal");

      const postLamports = postEvent.lamports;

      expect(postLamports).to.be.at.least(rent);

      const diff = preLamports - postLamports;
      const expectedToSend = Math.min(withdrawAmount.toNumber(), available);

      expect(diff).to.equal(expectedToSend);
    });

    it("Fails if the signer is not the organizer", async () => {
      const other = Keypair.generate();

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(other.publicKey, LAMPORTS_PER_SOL)
      );

      let isError = false;

      try {
        await program.methods
          .withdraw(new anchor.BN(0))
          .accounts({
            signer: other.publicKey,
            event: unauthEventPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([other])
          .rpc();
      } catch(err) {
        isError = true;
        expect(err).to.have.property("logs");
      }
      expect(isError).to.be.true;
    });

    it("Fails if there are no funds", async () => {
      const noFundsInfo = await provider.connection.getAccountInfo(noFundsEventPda);
      if(!noFundsInfo) throw new Error("there are no funds");
      const rent = await provider.connection.getMinimumBalanceForRentExemption(noFundsInfo.data.length);
      expect(noFundsInfo.lamports).to.be.at.most(rent + 10_000);
      let isError = false;

      try {
        await program.methods
          .withdraw(new anchor.BN(1))
          .accounts({
            signer: wallet.publicKey,
            event: noFundsEventPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        } catch(err) {
          isError = true;
          expect(err).to.have.property("logs");
        }
        expect(isError).to.be.true;
    });
  });

  describe("join_event", () => {
  const EVENT_ID_JOIN = new anchor.BN(20);
  let joinEventPda: PublicKey;

  before(async () => {
    [joinEventPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("event"),
        wallet.publicKey.toBuffer(),
        EVENT_ID_JOIN.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const price = new anchor.BN(1);

    await program.methods
      .initEvent(EVENT_ID_JOIN, price, "Join Event", "Join event description")
      .accounts({
        signer: wallet.publicKey,
        event: joinEventPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("Join an event and get an NFT", async () => {
    const eventAccountBefore = await program.account.event.fetch(joinEventPda);
    const eventPrice = eventAccountBefore.price.toNumber();

    const [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        joinEventPda.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    const mintKeypair = Keypair.generate();
    const mintPubkey = mintKeypair.publicKey;

    const [mintAuthPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_auth"), mintPubkey.toBuffer()],
      program.programId
    );

    const createdMintPubkey = await createMint(
      provider.connection,
      wallet.payer,
      mintAuthPda,
      null,
      0,
      mintKeypair
    );

    const buyerAtaAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintPubkey,
      wallet.publicKey
    );
    const buyerAta = buyerAtaAccount.address;

    const eventInfoBefore = await provider.connection.getAccountInfo(joinEventPda);
    if (!eventInfoBefore) throw new Error("Event account not found");
    const lamportsBefore = eventInfoBefore.lamports;

    await program.methods
      .joinEvent()
      .accounts({
        signer: wallet.publicKey,
        event: joinEventPda,
        ticket: ticketPda,
        mint: mintPubkey,
        mintAuthority: mintAuthPda,
        buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const ticketAccount = await program.account.ticket.fetch(ticketPda);
    expect(ticketAccount.owner.toBase58()).to.equal(
      wallet.publicKey.toBase58()
    );
    expect(ticketAccount.event.toBase58()).to.equal(joinEventPda.toBase58());
    expect(ticketAccount.mint.toBase58()).to.equal(mintPubkey.toBase58());
    expect(ticketAccount.checkedIn).to.be.false;

    const mintInfo = await getMint(provider.connection, mintPubkey);
    expect(Number(mintInfo.supply)).to.equal(1);

    const ataInfo = await getAccount(provider.connection, buyerAta);
    expect(Number(ataInfo.amount)).to.equal(1);

    const eventInfoAfter = await provider.connection.getAccountInfo(joinEventPda);
    if (!eventInfoAfter) throw new Error("Event account not found after joining");
    const lamportsAfter = eventInfoAfter.lamports;

    expect(lamportsAfter - lamportsBefore).to.equal(eventPrice);
  });

  it("Fails if there is already a ticket for the same user and same event", async () => {
    const owner = wallet.publicKey;

    const EVENT_ID_DUP = new anchor.BN(99);
    const [dupEventPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("event"),
        owner.toBuffer(),
        EVENT_ID_DUP.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const price = new anchor.BN(1);
    await program.methods
      .initEvent(EVENT_ID_DUP, price, "Dup Event", "Dup event description")
      .accounts({
        signer: owner,
        event: dupEventPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const [ticketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("ticket"),
        dupEventPda.toBuffer(),
        owner.toBuffer(),
      ],
      program.programId
    );

    const mintKeypair1 = Keypair.generate();
    const mintPubkey1 = mintKeypair1.publicKey;

    const [mintAuthPda1] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_auth"), mintPubkey1.toBuffer()],
      program.programId
    );

    const createdMintPubkey1 = await createMint(
      provider.connection,
      wallet.payer,
      mintAuthPda1,
      null,
      0,
      mintKeypair1
    );

    const buyerAtaAccount1 = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintPubkey1,
      owner
    );
    const buyerAta1 = buyerAtaAccount1.address;

    await program.methods
      .joinEvent()
      .accounts({
        signer: owner,
        event: dupEventPda,
        ticket: ticketPda,
        mint: mintPubkey1,
        mintAuthority: mintAuthPda1,
        buyerAta: buyerAta1,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const mintKeypair2 = Keypair.generate();
    const mintPubkey2 = mintKeypair2.publicKey;

    const [mintAuthPda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_auth"), mintPubkey2.toBuffer()],
      program.programId
    );

    const createdMintPubkey2 = await createMint(
      provider.connection,
      wallet.payer,
      mintAuthPda2,
      null,
      0,
      mintKeypair2
    );

    const buyerAtaAccount2 = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mintPubkey2,
      owner
    );
    const buyerAta2 = buyerAtaAccount2.address;

    let isError = false;
    try {
      await program.methods
        .joinEvent()
        .accounts({
          signer: owner,
          event: dupEventPda,
          ticket: ticketPda,
          mint: mintPubkey2,
          mintAuthority: mintAuthPda2,
          buyerAta: buyerAta2,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err) {
      isError = true;
      expect(err).to.have.property("logs");
    }

    expect(isError).to.be.true;
  });
});

});
